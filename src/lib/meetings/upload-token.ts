import { createHmac, timingSafeEqual } from "node:crypto";

export interface UploadTokenPayload {
  userId: string;
  r2Key: string;
  contentType: string;
  fileSize: number;
  expiresAt: number;
}

function getUploadTokenSecret(): string {
  const secret = process.env.UPLOAD_TOKEN_SECRET;
  if (!secret?.trim()) throw new Error("Missing UPLOAD_TOKEN_SECRET");
  return secret;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signValue(value: string): string {
  return createHmac("sha256", getUploadTokenSecret())
    .update(value)
    .digest("base64url");
}

function isUploadTokenPayload(value: unknown): value is UploadTokenPayload {
  if (!value || typeof value !== "object") return false;

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.userId === "string" &&
    payload.userId.length > 0 &&
    typeof payload.r2Key === "string" &&
    payload.r2Key.length > 0 &&
    typeof payload.contentType === "string" &&
    payload.contentType.length > 0 &&
    typeof payload.fileSize === "number" &&
    Number.isFinite(payload.fileSize) &&
    payload.fileSize > 0 &&
    typeof payload.expiresAt === "number" &&
    Number.isFinite(payload.expiresAt)
  );
}

export function signUploadToken(payload: UploadTokenPayload): string {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyUploadToken(token: string): UploadTokenPayload {
  const [encodedPayload, providedSignature] = token.split(".");

  if (!encodedPayload || !providedSignature) {
    throw new Error("Token de upload inválido.");
  }

  const expectedSignature = signValue(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new Error("Token de upload inválido.");
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(fromBase64Url(encodedPayload));
  } catch {
    throw new Error("Token de upload inválido.");
  }

  if (!isUploadTokenPayload(parsedPayload)) {
    throw new Error("Token de upload inválido.");
  }

  if (parsedPayload.expiresAt <= Date.now()) {
    throw new Error("Token de upload expirado.");
  }

  return parsedPayload;
}
