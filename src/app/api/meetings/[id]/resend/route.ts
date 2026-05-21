// ─────────────────────────────────────────────────────────────────────────────
// POST /api/meetings/[id]/resend — Resend WhatsApp summary (max 3 per meeting)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireOwnership } from "@/lib/api/auth";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import {
  getWhatsAppSummaryAccess,
  WHATSAPP_SUMMARY_PAID_PLAN_REQUIRED_MESSAGE,
} from "@/lib/billing/whatsapp-summary-access";
import { sendMeetingSummaryTemplate } from "@/lib/whatsapp";
import type { MeetingJSON, WhatsAppStatus } from "@/types/database";

const MAX_RESENDS = 3;

export const POST = withAuthRateLimit<{ id: string }, NextRequest>(
  RATE_LIMIT_POLICIES.meetingResend,
  async (_request: NextRequest, { params, auth }) => {
  const meetingId = params.id;
  const supabase = auth.supabaseAdmin;
  await requireOwnership(supabase, "meetings", meetingId, auth.user.id);

  try {
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("id, user_id, title, summary_whatsapp, whatsapp_number, whatsapp_status, summary_json")
      .eq("id", meetingId)
      .single();

    if (meetingError || !meeting) {
      return NextResponse.json(
        { error: "Acesso negado." },
        { status: 403 }
      );
    }

    const whatsappAccess = await getWhatsAppSummaryAccess(auth.user.id, supabase);
    if (!whatsappAccess.canSend) {
      return NextResponse.json(
        { error: WHATSAPP_SUMMARY_PAID_PLAN_REQUIRED_MESSAGE },
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

    // ── Send WhatsApp template ───────────────────────────────────────────
    const result = await sendMeetingSummaryTemplate(
      meeting.whatsapp_number,
      meeting.summary_json as Partial<MeetingJSON> | null,
      meetingId,
      meeting.title
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
        error_message: result.success
          ? null
          : `WhatsApp template resend failed: ${result.error ?? "unknown error"}`,
        summary_json: updatedMetadata,
      })
      .eq("id", meetingId);

    if (!result.success) {
      console.error(
        `[meetings/resend] WhatsApp template resend failed for meeting ${meetingId}: ${result.error}`
      );

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
);
