import { NextRequest, NextResponse } from "next/server";
import { requireOwnership } from "@/lib/api/auth";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import { MeetingTemplateNotFoundError, deleteTemplate } from "@/lib/meeting-templates";

export const DELETE = withAuthRateLimit<{ id: string }, NextRequest>(
  RATE_LIMIT_POLICIES.meetingTemplatesMutate,
  async (_request: NextRequest, { params, auth }) => {
    try {
      await requireOwnership(
        auth.supabaseAdmin,
        "meeting_templates",
        params.id,
        auth.user.id
      );
      await deleteTemplate(auth.supabaseAdmin, auth.user.id, params.id);
      return new NextResponse(null, { status: 204 });
    } catch (error) {
      if (error instanceof Response) return error;

      if (error instanceof MeetingTemplateNotFoundError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      console.error("[meeting-templates/[id]] failed to delete:", error);
      return NextResponse.json(
        { error: "Erro ao remover modelo de ata." },
        { status: 500 }
      );
    }
  }
);
