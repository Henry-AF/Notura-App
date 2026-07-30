// Mirrors the web's task colors exactly, for visual fidelity (NOT-150):
// `src/lib/tasks/task-mapper.ts` (COLUMN_DEFS) and
// `src/components/tasks/TaskCard.tsx` (PRIORITY_COLORS). These are literal
// brand hex values, not derived from the shared light/dark palette, so they
// live here rather than in `@/theme`.

import type { TaskPriority, TaskStatus } from './tasks-api';

export interface StatusColumnDef {
  id: TaskStatus;
  title: string;
  dotColor: string;
  badgeColor: string;
  badgeBg: string;
}

export const STATUS_COLUMNS: StatusColumnDef[] = [
  { id: 'todo', title: 'A Fazer', dotColor: '#6C5CE7', badgeColor: '#A29BFE', badgeBg: 'rgba(108,92,231,0.15)' },
  {
    id: 'in_progress',
    title: 'Em Andamento',
    dotColor: '#FFA94D',
    badgeColor: '#FFA94D',
    badgeBg: 'rgba(255,169,77,0.15)',
  },
  {
    id: 'completed',
    title: 'Concluído',
    dotColor: '#4ECB71',
    badgeColor: '#4ECB71',
    badgeBg: 'rgba(78,203,113,0.15)',
  },
];

export function getStatusColumn(status: TaskStatus): StatusColumnDef {
  return STATUS_COLUMNS.find((column) => column.id === status) ?? STATUS_COLUMNS[0];
}

export const PRIORITY_VISUALS: Record<TaskPriority, { color: string; label: string }> = {
  alta: { color: '#FF6B6B', label: 'ALTA' },
  media: { color: '#FFA94D', label: 'MÉDIA' },
  baixa: { color: '#4ECB71', label: 'BAIXA' },
};

export const MEETING_LINK_COLOR = '#6C5CE7';

export function formatDueDate(dueDate?: string): string | null {
  if (!dueDate) return null;
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return dueDate;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

