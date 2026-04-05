import { NextResponse } from "next/server";

// GET /api/tasks
export async function GET() {
  return NextResponse.json({ columns: [] });
}

// POST /api/tasks
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  if (!data.title || typeof data.title !== "string") {
    return NextResponse.json(
      { error: "Field 'title' (string) is required." },
      { status: 400 }
    );
  }

  const task = {
    id: `task-${Date.now()}`,
    title: data.title,
    priority: data.priority ?? "media",
    columnId: data.columnId ?? "todo",
    generatedByAI: data.generatedByAI ?? false,
    meetingSource: data.meetingSource ?? null,
    filesCount: data.filesCount ?? null,
    dueDate: data.dueDate ?? null,
    completedDate: null,
    progress: data.progress ?? null,
    assignee: data.assignee ?? null,
  };

  return NextResponse.json({ task }, { status: 201 });
}
