// ─────────────────────────────────────────────────────────────────────────────
// Notura — Cloudflare R2 storage (audio files)
// ─────────────────────────────────────────────────────────────────────────────

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "https";

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  // Em desenvolvimento, ignora erros de certificado causados por proxies corporativos.
  // Em produção (Vercel) rejectUnauthorized fica true (padrão seguro).
  ...(process.env.NODE_ENV === "development" && {
    requestHandler: new NodeHttpHandler({
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    }),
  }),
});

const BUCKET = process.env.R2_BUCKET_NAME || "notura-audio";

export async function uploadAudio(
  key: string,
  body: Buffer | ReadableStream,
  contentType: string
): Promise<string> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body as Buffer,
      ContentType: contentType,
    })
  );
  return key;
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2Client, command, { expiresIn });
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  return getSignedUrl(r2Client, command, { expiresIn });
}

export async function downloadAudio(key: string): Promise<Buffer> {
  const response = await r2Client.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
  const stream = response.Body as ReadableStream;
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let done = false;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (result.value) chunks.push(result.value);
  }
  return Buffer.concat(chunks);
}

export async function deleteAudio(key: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}

export async function checkR2Health(): Promise<void> {
  await r2Client.send(
    new HeadBucketCommand({
      Bucket: BUCKET,
    })
  );
}

export function buildR2Key(userId: string, filename: string): string {
  const timestamp = Date.now();
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `meetings/${userId}/${timestamp}/${safeFilename}`;
}
