import { beforeEach } from "vitest";

const TEST_UPSTASH_URL = "https://notura-upstash.test";
const TEST_UPSTASH_TOKEN = "test-upstash-token";

const originalFetch = globalThis.fetch.bind(globalThis);
const rateLimitStore = new Map<string, number[]>();

beforeEach(() => {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    process.env.UPSTASH_REDIS_REST_URL = TEST_UPSTASH_URL;
  }

  if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
    process.env.UPSTASH_REDIS_REST_TOKEN = TEST_UPSTASH_TOKEN;
  }

  rateLimitStore.clear();
});

function readRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function buildUpstashResponse(command: string[]) {
  const key = command[3];
  const nowMs = Number(command[4]);
  const windowMs = Number(command[5]);
  const limit = Number(command[6]);
  const entries = (rateLimitStore.get(key) ?? []).filter(
    (entry) => entry > nowMs - windowMs
  );

  if (entries.length >= limit) {
    rateLimitStore.set(key, entries);
    return Response.json({ result: [0, entries.length, entries[0] ?? nowMs] });
  }

  entries.push(nowMs);
  entries.sort((a, b) => a - b);
  rateLimitStore.set(key, entries);
  return Response.json({ result: [1, entries.length, entries[0] ?? nowMs] });
}

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  if (readRequestUrl(input) === process.env.UPSTASH_REDIS_REST_URL?.trim()) {
    const command = JSON.parse(String(init?.body)) as string[];
    return buildUpstashResponse(command);
  }

  return originalFetch(input, init);
};
