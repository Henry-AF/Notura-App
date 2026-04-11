import { NextRequest, NextResponse } from "next/server";
import { withPublicRateLimit } from "@/lib/api/rate-limit-route";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import {
  getReadinessHttpStatus,
  runReadinessChecks,
} from "@/lib/health/readiness";

function hasValidHealthToken(request: NextRequest): boolean {
  const expectedToken = process.env.HEALTHCHECK_TOKEN?.trim();
  if (!expectedToken) {
    return true;
  }

  const providedToken = request.headers.get("x-health-token")?.trim();
  return providedToken === expectedToken;
}

export const GET = withPublicRateLimit<NextRequest>(
  RATE_LIMIT_POLICIES.internalHealth,
  async (request: NextRequest) => {
    if (!hasValidHealthToken(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const report = await runReadinessChecks();
    const response = NextResponse.json(report, {
      status: getReadinessHttpStatus(report.status),
    });

    response.headers.set("X-Health-Status", report.status);

    return response;
  }
);
