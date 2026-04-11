import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createServerSupabase, createServiceRoleClient } from "@/lib/supabase/server";
import {
  captureObservedError,
  createRequestId,
  getErrorMessage,
  getRoutePath,
  logStructured,
  withRequestIdHeader,
} from "@/lib/observability";
import type { Database } from "@/types/database";

type RouteParams = Record<string, string>;
type OwnedTableName = keyof Database["public"]["Tables"];
type OwnedResourceRow = {
  id: string;
  user_id: string;
};

export interface RouteAuthContext {
  user: User;
  supabase: ReturnType<typeof createServerSupabase>;
  supabaseAdmin: SupabaseClient<Database>;
}

interface RouteContext<TParams extends RouteParams> {
  params: TParams;
}

interface AuthenticatedRouteContext<TParams extends RouteParams>
  extends RouteContext<TParams> {
  auth: RouteAuthContext;
}

type AuthenticatedRouteHandler<
  TParams extends RouteParams,
  TRequest extends Request = Request
> = (
  request: TRequest,
  context: AuthenticatedRouteContext<TParams>
) => Promise<Response>;

function unauthorizedResponse() {
  return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
}

export async function requireAuth(): Promise<RouteAuthContext> {
  const supabase = createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw unauthorizedResponse();
  }

  return {
    user,
    supabase,
    supabaseAdmin: createServiceRoleClient(),
  };
}

export async function requireOwnership(
  supabaseAdmin: SupabaseClient<Database>,
  table: OwnedTableName,
  resourceId: string,
  userId: string
) {
  const { data, error } = (await supabaseAdmin
    .from(table)
    .select("id, user_id")
    .eq("id", resourceId)
    .maybeSingle()) as {
    data: OwnedResourceRow | null;
    error: unknown;
  };

  if (error || !data || data.user_id !== userId) {
    throw forbiddenResponse();
  }
}

export function withAuth<
  TParams extends RouteParams = RouteParams,
  TRequest extends Request = Request
>(
  handler: AuthenticatedRouteHandler<TParams, TRequest>
) {
  return async (
    request: TRequest,
    context: RouteContext<TParams>
  ): Promise<Response> => {
    const requestId = createRequestId(request);
    const route = getRoutePath(request);
    const startedAt = Date.now();
    let userId: string | undefined;

    try {
      const auth = await requireAuth();
      userId = auth.user.id;
      const response = await handler(request, { ...context, auth });
      withRequestIdHeader(response, requestId);

      logStructured("info", {
        event: "api.request.completed",
        requestId,
        userId,
        route,
        durationMs: Date.now() - startedAt,
        status: response.status,
      });

      if (response.status >= 500) {
        captureObservedError(new Error(`API route returned status ${response.status}`), {
          event: "api.request.failed",
          requestId,
          userId,
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
      if (error instanceof Response) {
        withRequestIdHeader(error, requestId);
        logStructured("warn", {
          event: "api.request.completed",
          requestId,
          userId,
          route,
          durationMs: Date.now() - startedAt,
          status: error.status,
        });

        if (error.status >= 500) {
          captureObservedError(new Error(`API route returned status ${error.status}`), {
            event: "api.request.failed",
            requestId,
            userId,
            route,
            durationMs: Date.now() - startedAt,
            status: error.status,
            extra: {
              captureReason: "response_status",
            },
          });
        }

        return error;
      }

      const durationMs = Date.now() - startedAt;
      const message = getErrorMessage(error);

      logStructured("error", {
        event: "api.request.failed",
        requestId,
        userId,
        route,
        durationMs,
        status: 500,
        errorMessage: message,
      });

      captureObservedError(error, {
        event: "api.request.failed",
        requestId,
        userId,
        route,
        durationMs,
        status: 500,
      });

      throw error;
    }
  };
}
