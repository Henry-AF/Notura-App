import type { Column } from "@/components/tasks";
import { getOwnedTaskBoard } from "@/lib/tasks/board";
import { buildTaskColumns, type TaskMeetingOption } from "@/lib/tasks/task-mapper";
import { TasksClient } from "./tasks-client";

interface TasksPageProps {
  searchParams: Promise<{ meetingId?: string; groupId?: string }>;
}

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const { meetingId, groupId } = await searchParams;

  let initialColumns: Column[];
  let meetings: TaskMeetingOption[];
  let loadError: string | undefined;

  try {
    const data = await getOwnedTaskBoard({ meetingId, groupId });
    initialColumns = data.columns;
    meetings = data.meetings;
  } catch (error) {
    initialColumns = buildTaskColumns([]);
    meetings = [];
    loadError = error instanceof Error ? error.message : "Erro ao carregar tarefas.";
  }

  return (
    <TasksClient initialColumns={initialColumns} meetings={meetings} loadError={loadError} />
  );
}
