import { NextRequest, NextResponse } from "next/server";
import { requireOwnership } from "@/lib/api/auth";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import {
  AtaExportPaidPlanRequiredError,
  requireExportPaidPlan,
} from "@/lib/billing/ata-export-access";
import {
  CustomTemplateProRequiredError,
  requireCustomTemplateAccess,
} from "@/lib/billing/custom-template-access";
import { InvalidAtaTemplateError, renderAtaDocx } from "@/lib/docx/generate-ata";
import { buildAtaData, buildAtaFilename } from "@/lib/docx/meeting-ata-data";
import {
  DEFAULT_TEMPLATE_ID,
  MeetingTemplateNotFoundError,
  resolveTemplateBuffer,
} from "@/lib/meeting-templates";
import { getOwnedMeetingWithRelationsForAuth } from "@/lib/meetings/detail";
import { buildAtaExportR2Key, getPresignedDownloadUrl, uploadAudio } from "@/lib/r2";

const EXPORT_URL_EXPIRES_IN_SECONDS = 3600;
const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

interface ExportRequestBody {
  templateId?: unknown;
}

async function parseTemplateId(request: NextRequest): Promise<string> {
  try {
    const body = (await request.json()) as ExportRequestBody;
    return typeof body.templateId === "string" && body.templateId.trim()
      ? body.templateId.trim()
      : DEFAULT_TEMPLATE_ID;
  } catch {
    return DEFAULT_TEMPLATE_ID;
  }
}

export const POST = withAuthRateLimit<{ id: string }, NextRequest>(
  RATE_LIMIT_POLICIES.meetingExport,
  async (request: NextRequest, { params, auth }) => {
    try {
      await requireOwnership(auth.supabaseAdmin, "meetings", params.id, auth.user.id);
      await requireExportPaidPlan(auth.user.id, auth.supabaseAdmin);

      const templateId = await parseTemplateId(request);

      if (templateId !== DEFAULT_TEMPLATE_ID) {
        await requireOwnership(
          auth.supabaseAdmin,
          "meeting_templates",
          templateId,
          auth.user.id
        );
        await requireCustomTemplateAccess(auth.user.id, auth.supabaseAdmin);
      }

      const meeting = await getOwnedMeetingWithRelationsForAuth(auth, params.id);
      const templateBuffer = await resolveTemplateBuffer(
        auth.supabaseAdmin,
        auth.user.id,
        templateId
      );
      const docxBuffer = renderAtaDocx(templateBuffer, buildAtaData(meeting));

      const r2Key = buildAtaExportR2Key(auth.user.id, params.id);
      await uploadAudio(r2Key, docxBuffer, DOCX_CONTENT_TYPE);
      const url = await getPresignedDownloadUrl(r2Key, EXPORT_URL_EXPIRES_IN_SECONDS);

      return NextResponse.json({
        url,
        filename: buildAtaFilename(meeting),
        expiresIn: EXPORT_URL_EXPIRES_IN_SECONDS,
      });
    } catch (error) {
      if (error instanceof Response) return error;

      if (
        error instanceof AtaExportPaidPlanRequiredError ||
        error instanceof CustomTemplateProRequiredError
      ) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      if (error instanceof MeetingTemplateNotFoundError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      if (error instanceof InvalidAtaTemplateError) {
        return NextResponse.json({ error: error.message }, { status: 422 });
      }

      console.error("[meetings/export] failed to generate ata:", error);
      return NextResponse.json(
        { error: "Erro ao gerar a ata. Tente novamente." },
        { status: 500 }
      );
    }
  }
);
