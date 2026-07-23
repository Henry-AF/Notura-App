// Manual/CI-friendly smoke test for NOT-113: confirms that the routes used by
// the mobile app accept `Authorization: Bearer <supabase_jwt>` without a cookie,
// and reject a tampered/invalid one.
//
// Usage:
//   SUPABASE_ACCESS_TOKEN=<jwt> node scripts/verify-bearer-auth.mjs
//
// Optional env vars:
//   BASE_URL          Defaults to http://localhost:3000
//   TEST_MEETING_ID   ID of a meeting owned by the token's user. Routes that
//                     require it are skipped (with a warning) when unset.
//   RUN_MUTATIONS     Set to "1" to also call the POST routes that require a
//                     JSON body (chats, upload, process). These are skipped by
//                     default because they either mutate data (creates a chat,
//                     consumes billing quota) or need real payloads (a signed
//                     upload token, an uploaded R2 object) that this script
//                     cannot fabricate.
//
// Each route runs twice:
//   1. With SUPABASE_ACCESS_TOKEN — expected to return 2xx. The single named
//      exception is POST /api/assemblyai/token, which may return 502 when the
//      upstream AssemblyAI API itself is unavailable (a downstream failure,
//      not an auth failure — see knownDownstreamStatuses below).
//   2. With a deliberately tampered copy of that token (corrupted JWT
//      signature) — expected to return exactly 401.
// Any other status is reported as a FAIL, not treated as a pass by
// elimination. The script exits non-zero if any check fails.

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const MEETING_ID = process.env.TEST_MEETING_ID;
const RUN_MUTATIONS = process.env.RUN_MUTATIONS === "1";

if (!ACCESS_TOKEN) {
  console.error("Missing SUPABASE_ACCESS_TOKEN env var. Aborting.");
  process.exit(1);
}

/**
 * @typedef {{
 *   label: string,
 *   method: string,
 *   path: string,
 *   body?: unknown,
 *   requiresMeetingId?: boolean,
 *   optional?: boolean,
 *   knownDownstreamStatuses?: number[],
 * }} RouteCheck
 */

/** @type {RouteCheck[]} */
const ROUTE_CHECKS = [
  { label: "GET /api/meetings", method: "GET", path: "/api/meetings" },
  {
    label: "GET /api/meetings/:id",
    method: "GET",
    path: "/api/meetings/:id",
    requiresMeetingId: true,
  },
  {
    label: "GET /api/meetings/:id/status",
    method: "GET",
    path: "/api/meetings/:id/status",
    requiresMeetingId: true,
  },
  {
    label: "GET /api/meetings/:id/chats",
    method: "GET",
    path: "/api/meetings/:id/chats",
    requiresMeetingId: true,
  },
  {
    label: "POST /api/meetings/:id/chats",
    method: "POST",
    path: "/api/meetings/:id/chats",
    body: { question: "Ping de verificação de auth (NOT-113)." },
    requiresMeetingId: true,
    optional: true,
  },
  { label: "GET /api/tasks", method: "GET", path: "/api/tasks" },
  { label: "GET /api/task-labels", method: "GET", path: "/api/task-labels" },
  { label: "GET /api/user/me", method: "GET", path: "/api/user/me" },
  { label: "GET /api/meeting-groups", method: "GET", path: "/api/meeting-groups" },
  {
    label: "POST /api/assemblyai/token",
    method: "POST",
    path: "/api/assemblyai/token",
    body: {},
    // Named exception, not a generic catch-all: AssemblyAI's own API can be
    // unavailable/misconfigured for this account (seen during NOT-113
    // verification as a 404 from AssemblyAI itself), which this route
    // surfaces as a 502. That is a downstream failure, not an auth failure.
    knownDownstreamStatuses: [502],
  },
  {
    label: "POST /api/meetings/upload",
    method: "POST",
    path: "/api/meetings/upload",
    body: {},
    optional: true,
  },
  {
    label: "POST /api/meetings/process",
    method: "POST",
    path: "/api/meetings/process",
    body: {},
    optional: true,
  },
];

function resolvePath(check) {
  if (!check.requiresMeetingId) return check.path;
  return check.path.replace(":id", String(MEETING_ID));
}

function shouldSkip(check) {
  if (check.requiresMeetingId && !MEETING_ID) {
    return "skipped: TEST_MEETING_ID not set";
  }
  if (check.optional && !RUN_MUTATIONS) {
    return "skipped: mutating route, set RUN_MUTATIONS=1 to run";
  }
  return null;
}

/**
 * Corrupts a JWT's signature segment so Supabase rejects it, guaranteeing a
 * real 401 without needing a second logged-in test user.
 */
function deriveInvalidToken(validToken) {
  const parts = validToken.split(".");
  if (parts.length !== 3) return `${validToken}-tampered`;
  const [header, payload, signature] = parts;
  const corruptedSignature = signature.split("").reverse().join("") || "x";
  return `${header}.${payload}.${corruptedSignature}`;
}

async function callRoute(check, token) {
  const url = `${BASE_URL}${resolvePath(check)}`;
  const init = {
    method: check.method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(check.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(check.body !== undefined ? { body: JSON.stringify(check.body) } : {}),
  };

  const response = await fetch(url, init);
  return response.status;
}

function isSuccessStatus(status) {
  return status >= 200 && status < 300;
}

/** @returns {{ pass: boolean, reason: string }} */
function classifyValidTokenResult(check, status) {
  if (isSuccessStatus(status)) {
    return { pass: true, reason: `${status}` };
  }
  if (check.knownDownstreamStatuses?.includes(status)) {
    return { pass: true, reason: `${status} (known downstream exception)` };
  }
  return { pass: false, reason: `expected 2xx, got ${status}` };
}

/** @returns {{ pass: boolean, reason: string }} */
function classifyInvalidTokenResult(status) {
  if (status === 401) {
    return { pass: true, reason: "401 as expected" };
  }
  return { pass: false, reason: `expected 401, got ${status}` };
}

async function runCheck(check, { mode, token }) {
  const skipReason = shouldSkip(check);
  if (skipReason) {
    console.log(`[SKIP] ${mode} ${check.label} (${skipReason})`);
    return true;
  }

  try {
    const status = await callRoute(check, token);
    const result =
      mode === "valid" ? classifyValidTokenResult(check, status) : classifyInvalidTokenResult(status);
    const tag = result.pass ? "OK" : "FAIL";
    console.log(`[${tag}] ${mode} ${check.method} ${resolvePath(check)} -> ${result.reason}`);
    return result.pass;
  } catch (error) {
    console.log(`[FAIL] ${mode} ${check.label} -> request error: ${String(error)}`);
    return false;
  }
}

async function main() {
  console.log(`Verifying Bearer auth against ${BASE_URL}\n`);
  const invalidToken = deriveInvalidToken(ACCESS_TOKEN);

  let allPassed = true;

  console.log("-- valid token: expecting 2xx (see named exceptions per route) --");
  for (const check of ROUTE_CHECKS) {
    const passed = await runCheck(check, { mode: "valid", token: ACCESS_TOKEN });
    allPassed = allPassed && passed;
  }

  console.log("\n-- tampered token: expecting exactly 401 --");
  for (const check of ROUTE_CHECKS) {
    const passed = await runCheck(check, { mode: "invalid", token: invalidToken });
    allPassed = allPassed && passed;
  }

  if (!allPassed) {
    console.error("\nOne or more checks did not match the expected status. See FAIL lines above.");
    process.exit(1);
  }
  console.log("\nAll checks matched their expected status.");
}

await main();
