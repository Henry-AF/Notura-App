// ─────────────────────────────────────────────────────────────────────────────
// Inngest serve endpoint — registers all Inngest functions with the platform
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "inngest/next";
import type { NextRequest } from "next/server";
import { inngest } from "@/lib/inngest";
import { processMeeting, handleProcessMeetingFailure } from "@/inngest/process-meeting";
import {
  captureObservedError,
  createRequestId,
  getErrorMessage,
  getRoutePath,
  logStructured,
  withRequestIdHeader,
} from "@/lib/observability";

type InngestRouteHandler = (
  request: NextRequest,
  context?: unknown
) => Promise<Response>;

function withInngestRouteObservability(handler: InngestRouteHandler): InngestRouteHandler {
  return async (request: NextRequest, context?: unknown) => {
    const requestId = createRequestId(request);
    const route = getRoutePath(request);
    const startedAt = Date.now();

    try {
      const response = await handler(request, context);
      withRequestIdHeader(response, requestId);

      logStructured("info", {
        event: "api.request.completed",
        requestId,
        route,
        durationMs: Date.now() - startedAt,
        status: response.status,
      });

      if (response.status >= 500) {
        captureObservedError(new Error(`API route returned status ${response.status}`), {
          event: "api.request.failed",
          requestId,
          route,
          durationMs: Date.now() - startedAt,
          status: response.status,
          extra: {
            captureReason: "response_status",
          },
        });
      }

      return response;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = getErrorMessage(error);

      logStructured("error", {
        event: "api.request.failed",
        requestId,
        route,
        durationMs,
        status: 500,
        errorMessage: message,
      });

      captureObservedError(error, {
        event: "api.request.failed",
        requestId,
        route,
        durationMs,
        status: 500,
      });

      throw error;
    }
  };
}

const handler = serve({
  client: inngest,
  functions: [processMeeting, handleProcessMeetingFailure],
});

export const GET = withInngestRouteObservability(handler.GET);
export const POST = withInngestRouteObservability(handler.POST);
export const PUT = withInngestRouteObservability(handler.PUT);
