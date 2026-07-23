import { NextRequest, NextResponse } from "next/server";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import {
  CustomTemplateProRequiredError,
  requireCustomTemplateAccess,
} from "@/lib/billing/custom-template-access";
import {
  extractStructuredTags,
  extractTemplateTags,
  validateTemplateTags,
} from "@/lib/docx/placeholders";
import {
  MeetingTemplateValidationError,
  createTemplate,
  listTemplatesForUser,
} from "@/lib/meeting-templates";
import { buildTemplateR2Key, uploadAudio } from "@/lib/r2";

const MAX_TEMPLATE_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b]); // "PK"

export const GET = withAuthRateLimit<Record<string, never>, NextRequest>(
  RATE_LIMIT_POLICIES.meetingTemplatesRead,
  async (_request: NextRequest, { auth }) => {
    const templates = await listTemplatesForUser(auth.supabaseAdmin, auth.user.id);
    return NextResponse.json({ templates });
  }
);

function isDocxFilename(filename: string): boolean {
  return filename.toLowerCase().endsWith(".docx");
}

function hasZipSignature(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer.subarray(0, 2).equals(ZIP_SIGNATURE);
}

async function readTemplateUpload(request: NextRequest) {
  const formData = await request.formData();
  return { file: formData.get("file"), name: formData.get("name") };
}

export const POST = withAuthRateLimit<Record<string, never>, NextRequest>(
  RATE_LIMIT_POLICIES.templateUpload,
  async (request: NextRequest, { auth }) => {
    try {
      await requireCustomTemplateAccess(auth.user.id, auth.supabaseAdmin);

      const { file, name } = await readTemplateUpload(request);

      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Arquivo do modelo é obrigatório." },
          { status: 422 }
        );
      }

      if (!isDocxFilename(file.name)) {
        return NextResponse.json(
          { error: "Envie um arquivo .docx." },
          { status: 422 }
        );
      }

      if (file.size > MAX_TEMPLATE_FILE_SIZE) {
        return NextResponse.json(
          { error: "Arquivo muito grande. O limite é 5MB." },
          { status: 413 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      if (!hasZipSignature(buffer)) {
        return NextResponse.json(
          { error: "Arquivo .docx inválido ou corrompido." },
          { status: 422 }
        );
      }

      const tags = extractTemplateTags(buffer);
      const structuredTags = extractStructuredTags(buffer);
      const validation = validateTemplateTags(tags, structuredTags);

      if (validation.hasNoTags) {
        return NextResponse.json(
          {
            error:
              "Nenhum campo de mesclagem encontrado neste template — a ata não será personalizada com o conteúdo da reunião.",
          },
          { status: 422 }
        );
      }

      if (validation.invalidScalarArrayTags.length > 0) {
        return NextResponse.json(
          {
            error: `Os campos ${validation.invalidScalarArrayTags.join(", ")} precisam ser usados como lista no modelo (formato {#tag}...{/tag} no Word), não como texto simples. Confira o guia do template padrão.`,
            invalidScalarArrayTags: validation.invalidScalarArrayTags,
          },
          { status: 422 }
        );
      }

      if (!validation.valid) {
        return NextResponse.json(
          {
            error: "O modelo contém placeholders desconhecidos.",
            unknownPlaceholders: validation.unknown,
          },
          { status: 422 }
        );
      }

      const r2Key = buildTemplateR2Key(auth.user.id, file.name);
      await uploadAudio(r2Key, buffer, DOCX_CONTENT_TYPE);

      const template = await createTemplate(auth.supabaseAdmin, auth.user.id, {
        name: typeof name === "string" ? name : "",
        r2Key,
        originalFilename: file.name,
        placeholders: tags,
      });

      return NextResponse.json({ template }, { status: 201 });
    } catch (error) {
      if (error instanceof CustomTemplateProRequiredError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      if (error instanceof MeetingTemplateValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      console.error("[meeting-templates] failed to create:", error);
      return NextResponse.json(
        { error: "Erro ao salvar modelo de ata." },
        { status: 500 }
      );
    }
  }
);
