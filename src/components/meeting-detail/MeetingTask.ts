export interface MeetingTask {
  id: string;
  text: string;
  completed: boolean;
  status?: "todo" | "in_progress" | "completed";
  assignee?: string;
  priority?: "Alta" | "Média" | "Baixa";
  dueDate?: string;
  completedLabel?: string;
}
