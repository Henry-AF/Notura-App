import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { createTraceId, logStructured } from "@/lib/observability";
import {
  isIntegrationChannel,
  type IntegrationChannel,
} from "@/lib/integrations/integration-interest";
import { createServiceRoleClient } from "@/lib/supabase/server";

async function readChannel(request: Request): Promise<unknown> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    return body.channel;
  } catch {
    return undefined;
  }
}

export const GET = withAuth(async (_request, { auth }) => {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("integration_interest")
    .select("channel")
    .eq("user_id", auth.user.id);

  if (error) {
    return NextResponse.json(
      { error: "Erro ao buscar interesse em integrações." },
      { status: 500 }
    );
  }

  const channels = (data ?? []).map((row) => row.channel) as IntegrationChannel[];
  return NextResponse.json({ channels });
});

export const POST = withAuth(async (request, { auth }) => {
  const channel = await readChannel(request);

  if (!isIntegrationChannel(channel)) {
    return NextResponse.json({ error: "Canal inválido." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("integration_interest").upsert(
    { user_id: auth.user.id, channel },
    { onConflict: "user_id,channel", ignoreDuplicates: true }
  );

  if (error) {
    return NextResponse.json(
      { error: "Erro ao registrar interesse em integração." },
      { status: 500 }
    );
  }

  logStructured("info", {
    event: "integration.interest.captured",
    requestId: createTraceId(),
    route: "/api/integration-interest",
    durationMs: 0,
    status: 200,
    userId: auth.user.id,
    channel,
  });

  return NextResponse.json({ channel });
});
