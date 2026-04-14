// ─────────────────────────────────────────────────────────────────────────────
// POST /api/meetings/upload — Create a direct upload URL for Cloudflare R2
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { buildR2Key, getPresignedUploadUrl } from "@/lib/r2";
import { getBillingStatus } from "@/lib/billing";
import { signUploadToken } from "@/lib/meetings/upload-token";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const UPLOAD_URL_EXPIRES_IN_SECONDS = 900;

interface UploadInitPayload {
  fileName?: unknown;
  contentType?: unknown;
  fileSize?: unknown;
}

export const POST = withAuthRateLimit<Record<string, string>, NextRequest>(
  RATE_LIMIT_POLICIES.meetingsUpload,
  async (request: NextRequest, { auth }) => {
    const { billingAccount, meetingsThisMonth, monthlyLimit } =
      await getBillingStatus(auth.user.id);

    if (monthlyLimit !== null && meetingsThisMonth >= monthlyLimit) {
      return NextResponse.json(
        {
          error:
            billingAccount.plan === "free"
              ? "Você atingiu o limite do plano Free. Faça upgrade para processar mais reuniões."
              : `Você atingiu o limite mensal do seu plano (${monthlyLimit} reuniões).`,
        },
        { status: 403 }
      );
    }

    let body: UploadInitPayload;
    try {
      body = (await request.json()) as UploadInitPayload;
    } catch {
      return NextResponse.json(
        {
          error:
            "Requisição inválida. Envie JSON com fileName, contentType e fileSize.",
        },
        { status: 400 }
      );
    }

    const fileName =
      typeof body.fileName === "string" ? body.fileName.trim() : "";
    const contentType =
      typeof body.contentType === "string" ? body.contentType.trim() : "";
    const fileSize =
      typeof body.fileSize === "number" ? body.fileSize : Number.NaN;

    if (!fileName) {
      return NextResponse.json(
        { error: "Nome do arquivo é obrigatório." },
        { status: 422 }
      );
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json(
        { error: "Tamanho do arquivo inválido." },
        { status: 422 }
      );
    }

    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `Arquivo muito grande (${Math.round(fileSize / 1024 / 1024)}MB). O limite é 500MB.`,
        },
        { status: 413 }
      );
    }

    if (!contentType) {
      return NextResponse.json(
        { error: "Tipo do arquivo é obrigatório." },
        { status: 422 }
      );
    }

    if (!contentType.startsWith("audio/") && !contentType.startsWith("video/")) {
      return NextResponse.json(
        {
          error: `Tipo de arquivo não suportado: '${contentType}'. Envie um arquivo de áudio ou vídeo.`,
        },
        { status: 415 }
      );
    }

    const r2Key = buildR2Key(auth.user.id, fileName);

    try {
      const uploadUrl = await getPresignedUploadUrl(
        r2Key,
        contentType,
        UPLOAD_URL_EXPIRES_IN_SECONDS
      );
      const uploadToken = signUploadToken({
        userId: auth.user.id,
        r2Key,
        contentType,
        fileSize,
        expiresAt: Date.now() + UPLOAD_URL_EXPIRES_IN_SECONDS * 1000,
      });

      return NextResponse.json(
        {
          r2Key,
          uploadUrl,
          uploadToken,
          method: "PUT",
          expiresInSeconds: UPLOAD_URL_EXPIRES_IN_SECONDS,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("[meetings/upload] Failed to generate presigned upload URL", error);
      return NextResponse.json(
        { error: "Falha ao gerar URL de upload. Tente novamente." },
        { status: 500 }
      );
    }
  }
);
