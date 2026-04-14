import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createServerSupabase, createServiceRoleClient } from "@/lib/supabase/server";
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
  // eslint-disable-next-line
  const { data, error } = (await (supabaseAdmin as any)
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
    try {
      const auth = await requireAuth();
      return await handler(request, { ...context, auth });
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }

      throw error;
    }
  };
}
