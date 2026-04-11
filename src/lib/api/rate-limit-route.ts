import { withAuth } from "@/lib/api/auth";
import type { RouteAuthContext } from "@/lib/api/auth";
import {
  attachRateLimitHeaders,
  consumeRateLimit,
  createRateLimitExceededResponse,
  type RateLimitPolicy,
} from "@/lib/api/rate-limit";

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
    const decision = consumeRateLimit({
      request,
      policy,
    });

    if (decision.limited) {
      return createRateLimitExceededResponse(decision);
    }

    const response = await handler(request, context);
    return attachRateLimitHeaders(response, decision.headers);
  };
}
