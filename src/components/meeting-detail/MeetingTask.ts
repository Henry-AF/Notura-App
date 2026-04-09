export interface MeetingTask {
  id: string;
  text: string;
  completed: boolean;
  assignee?: string;
  priority?: "Alta" | "Média" | "Baixa";
  dueDate?: string;
  completedLabel?: string;
}
