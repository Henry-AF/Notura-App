import { withAuth } from "@/lib/api/auth";
import type { RouteAuthContext } from "@/lib/api/auth";
import {
  attachRateLimitHeaders,
  consumeRateLimit,
  createRateLimitExceededResponse,
  type RateLimitPolicy,
} from "@/lib/api/rate-limit";
import {
  captureObservedError,
  createRequestId,
  getErrorMessage,
  getRoutePath,
  logStructured,
  withRequestIdHeader,
} from "@/lib/observability";

type RouteParams = Record<string, string>;

interface RouteContext<TParams extends RouteParams> {
  params: TParams;
}

interface AuthenticatedRouteContext<TParams extends RouteParams>
  extends RouteContext<TParams> {
  auth: RouteAuthContext;
}

type AuthenticatedRateLimitedHandler<
  TParams extends RouteParams,
  TRequest extends Request
> = (
  request: TRequest,
  context: AuthenticatedRouteContext<TParams>
) => Promise<Response>;

type PublicRateLimitedHandler<
  TRequest extends Request,
  TContext
> = (
  request: TRequest,
  context: TContext
) => Promise<Response>;

export function withAuthRateLimit<
  TParams extends RouteParams = RouteParams,
  TRequest extends Request = Request
>(
  policy: RateLimitPolicy,
  handler: AuthenticatedRateLimitedHandler<TParams, TRequest>
) {
  return withAuth<TParams, TRequest>(async (request, context) => {
    const decision = consumeRateLimit({
      request,
      policy,
      userId: context.auth.user.id,
    });

    if (decision.limited) {
      return createRateLimitExceededResponse(decision);
    }

    const response = await handler(request, context);
    return attachRateLimitHeaders(response, decision.headers);
  });
}

export function withPublicRateLimit<
  TRequest extends Request = Request,
  TContext = undefined
>(
  policy: RateLimitPolicy,
  handler: PublicRateLimitedHandler<TRequest, TContext>
) {
  return async (request: TRequest, context: TContext): Promise<Response> => {
    const requestId = createRequestId(request);
    const route = getRoutePath(request);
    const startedAt = Date.now();

    try {
      const decision = consumeRateLimit({
        request,
        policy,
      });

      if (decision.limited) {
        const limitedResponse = createRateLimitExceededResponse(decision);
        withRequestIdHeader(limitedResponse, requestId);

        logStructured("warn", {
          event: "api.request.completed",
          requestId,
          route,
          durationMs: Date.now() - startedAt,
          status: limitedResponse.status,
        });

        return limitedResponse;
      }

      const response = await handler(request, context);
      attachRateLimitHeaders(response, decision.headers);
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
