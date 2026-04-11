import { createServiceRoleClient } from "@/lib/supabase/server";
import { checkR2Health } from "@/lib/r2";
import { getErrorMessage } from "@/lib/observability";

export type HealthStatus = "ok" | "degraded" | "down";

export interface DependencyHealth {
  status: HealthStatus;
  required: boolean;
  durationMs: number;
  message?: string;
}

export interface ReadinessReport {
  status: HealthStatus;
  checkedAt: string;
  durationMs: number;
  checks: {
    database: DependencyHealth;
    queue: DependencyHealth;
    providers: {
      assemblyai: DependencyHealth;
      gemini: DependencyHealth;
      r2: DependencyHealth;
    };
  };
}

export interface ReadinessDependencies {
  checkDatabase: () => Promise<void>;
  checkQueue: () => Promise<void>;
  checkAssemblyAi: () => Promise<void>;
  checkGemini: () => Promise<void>;
  checkR2: () => Promise<void>;
}

const PROVIDER_TIMEOUT_MS = 3_000;

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
}

function assertProviderResponse(name: string, response: Response) {
  if (response.status === 401 || response.status === 403) {
    throw new Error(`${name} credentials rejected (status ${response.status})`);
  }

  if (response.status >= 500) {
    throw new Error(`${name} provider unavailable (status ${response.status})`);
  }

  if (!response.ok) {
    throw new Error(`${name} healthcheck failed (status ${response.status})`);
  }
}

async function checkDatabaseConnection(): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("meetings")
    .select("id")
    .limit(1);

  if (error) {
    throw new Error(`Supabase healthcheck failed: ${error.message}`);
  }
}

async function checkQueueConfiguration(): Promise<void> {
  readRequiredEnv("INNGEST_EVENT_KEY");
  readRequiredEnv("INNGEST_SIGNING_KEY");
}

async function checkAssemblyAiAvailability(): Promise<void> {
  const apiKey = readRequiredEnv("ASSEMBLYAI_API_KEY");
  const response = await fetchWithTimeout(
    "https://api.assemblyai.com/v2/transcript?limit=1",
    {
      method: "GET",
      headers: {
        Authorization: apiKey,
      },
    }
  );

  assertProviderResponse("AssemblyAI", response);
}

async function checkGeminiAvailability(): Promise<void> {
  const apiKey = encodeURIComponent(readRequiredEnv("GEMINI_API_KEY"));
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${apiKey}`,
    {
      method: "GET",
    }
  );

  assertProviderResponse("Gemini", response);
}

async function checkR2Availability(): Promise<void> {
  readRequiredEnv("R2_ACCOUNT_ID");
  readRequiredEnv("R2_ACCESS_KEY_ID");
  readRequiredEnv("R2_SECRET_ACCESS_KEY");
  readRequiredEnv("R2_BUCKET_NAME");

  await checkR2Health();
}

function createDefaultDependencies(): ReadinessDependencies {
  return {
    checkDatabase: checkDatabaseConnection,
    checkQueue: checkQueueConfiguration,
    checkAssemblyAi: checkAssemblyAiAvailability,
    checkGemini: checkGeminiAvailability,
    checkR2: checkR2Availability,
  };
}

async function runSingleCheck(
  required: boolean,
  probe: () => Promise<void>
): Promise<DependencyHealth> {
  const startedAt = Date.now();

  try {
    await probe();
    return {
      status: "ok",
      required,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      status: required ? "down" : "degraded",
      required,
      durationMs: Date.now() - startedAt,
      message: getErrorMessage(error),
    };
  }
}

function resolveOverallStatus(
  database: DependencyHealth,
  queue: DependencyHealth,
  assemblyAi: DependencyHealth,
  gemini: DependencyHealth,
  r2: DependencyHealth
): HealthStatus {
  if (database.status === "down" || queue.status === "down") {
    return "down";
  }

  if (
    assemblyAi.status !== "ok" ||
    gemini.status !== "ok" ||
    r2.status !== "ok"
  ) {
    return "degraded";
  }

  if (database.status !== "ok" || queue.status !== "ok") {
    return "degraded";
  }

  return "ok";
}

export function getReadinessHttpStatus(status: HealthStatus): number {
  if (status === "down") return 503;
  if (status === "degraded") return 206;
  return 200;
}

export async function runReadinessChecks(
  dependencies: ReadinessDependencies = createDefaultDependencies()
): Promise<ReadinessReport> {
  const startedAt = Date.now();
  const [database, queue, assemblyai, gemini, r2] = await Promise.all([
    runSingleCheck(true, dependencies.checkDatabase),
    runSingleCheck(true, dependencies.checkQueue),
    runSingleCheck(false, dependencies.checkAssemblyAi),
    runSingleCheck(false, dependencies.checkGemini),
    runSingleCheck(false, dependencies.checkR2),
  ]);

  return {
    status: resolveOverallStatus(database, queue, assemblyai, gemini, r2),
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    checks: {
      database,
      queue,
      providers: {
        assemblyai,
        gemini,
        r2,
      },
    },
  };
}
