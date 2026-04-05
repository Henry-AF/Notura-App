import { NextResponse } from "next/server";

// POST /api/meetings/:id/retry

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: "Meeting ID required." }, { status: 400 });
  }

  // TODO: integrate with real reprocessing queue (e.g. Inngest)
  return NextResponse.json({ success: true, meetingId: id }, { status: 200 });
}
