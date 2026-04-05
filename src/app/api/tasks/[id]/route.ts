import { NextResponse } from "next/server";

// PATCH /api/tasks/:id
// Body: { completed?: boolean, columnId?: string, index?: number, completedDate?: string }

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: "Task ID required." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  // TODO: persist update in database
  return NextResponse.json({ success: true, id, ...body }, { status: 200 });
}

// DELETE /api/tasks/:id
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: "Task ID required." }, { status: 400 });
  }
  // TODO: delete from database
  return NextResponse.json({ success: true, id }, { status: 200 });
}
