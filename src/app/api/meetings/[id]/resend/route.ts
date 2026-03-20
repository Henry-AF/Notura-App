// ─────────────────────────────────────────────────────────────────────────────
// POST /api/meetings/[id]/resend — Resend WhatsApp summary (max 3 per meeting)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceRoleClient } from "@/lib/supabase/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import type { WhatsAppStatus } from "@/types/database";

const MAX_RESENDS = 3;

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const meetingId = params.id;

    // ── Auth ──────────────────────────────────────────────────────────────
    const supabaseAuth = createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    // ── Fetch meeting ────────────────────────────────────────────────────
    const supabase = createServiceRoleClient();

    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("id, user_id, summary_whatsapp, whatsapp_number, whatsapp_status, summary_json")
      .eq("id", meetingId)
      .single();

    if (meetingError || !meeting) {
      return NextResponse.json(
        { error: "Reunião não encontrada." },
        { status: 404 }
      );
    }

    // ── Authorization ────────────────────────────────────────────────────
    if (meeting.user_id !== user.id) {
      return NextResponse.json(
        { error: "Você não tem permissão para acessar esta reunião." },
        { status: 403 }
      );
    }

    // ── Validate summary exists ──────────────────────────────────────────
    if (!meeting.summary_whatsapp) {
      return NextResponse.json(
        { error: "Esta reunião ainda não tem um resumo gerado. Aguarde o processamento." },
        { status: 400 }
      );
    }

    if (!meeting.whatsapp_number) {
      return NextResponse.json(
        { error: "Nenhum número de WhatsApp cadastrado para esta reunião." },
        { status: 400 }
      );
    }

    // ── Rate limit: max 3 resends per meeting ────────────────────────────
    // Track resend count in summary_json metadata (simple approach)
    const metadata = (meeting.summary_json as Record<string, unknown>) ?? {};
    const resendCount = (metadata._resend_count as number) ?? 0;

    if (resendCount >= MAX_RESENDS) {
      return NextResponse.json(
        {
          error: `Limite de reenvios atingido (${MAX_RESENDS} por reunião). Entre em contato com o suporte se precisar de mais.`,
        },
        { status: 429 }
      );
    }

    // ── Send WhatsApp message ────────────────────────────────────────────
    const result = await sendWhatsAppMessage(
      meeting.whatsapp_number,
      meeting.summary_whatsapp
    );

    // ── Update meeting record ────────────────────────────────────────────
    const newStatus: WhatsAppStatus = result.success ? "sent" : "failed";
    const updatedMetadata = {
      ...metadata,
      _resend_count: resendCount + 1,
      _last_resend_at: new Date().toISOString(),
    };

    await supabase
      .from("meetings")
      .update({
        whatsapp_status: newStatus,
        summary_json: updatedMetadata,
      })
      .eq("id", meetingId);

    if (!result.success) {
      return NextResponse.json(
        {
          error: `Falha ao enviar WhatsApp: ${result.error ?? "erro desconhecido"}. Tente novamente em alguns minutos.`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      whatsapp_status: newStatus,
      resends_remaining: MAX_RESENDS - (resendCount + 1),
    });
  } catch (error) {
    console.error("[resend] Unexpected error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}
