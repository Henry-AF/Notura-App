import { NextRequest, NextResponse } from "next/server";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProcessBody {
  clientName: string;
  meetingDate: string;
  whatsappNumber?: string;
  fileName: string;
  fileSize: number;
}

// ─── POST /api/meetings/process ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const { clientName, meetingDate, fileName, fileSize } = body as ProcessBody;

  if (!clientName || typeof clientName !== "string" || clientName.trim() === "") {
    return NextResponse.json({ error: "Nome do cliente é obrigatório." }, { status: 422 });
  }
  if (!meetingDate || typeof meetingDate !== "string") {
    return NextResponse.json({ error: "Data da reunião é obrigatória." }, { status: 422 });
  }
  if (!fileName || typeof fileName !== "string") {
    return NextResponse.json({ error: "Nome do arquivo é obrigatório." }, { status: 422 });
  }
  if (typeof fileSize !== "number" || fileSize <= 0) {
    return NextResponse.json({ error: "Tamanho do arquivo inválido." }, { status: 422 });
  }

  // TODO: integrate real upload/processing pipeline (R2 + AssemblyAI / Gemini)
  // For now, return a mock meeting ID so the UI can redirect.
  const meetingId = `mock-${Date.now()}`;

  return NextResponse.json({ success: true, meetingId }, { status: 200 });
}
