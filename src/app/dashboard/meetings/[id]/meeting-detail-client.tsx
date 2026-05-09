"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, MessageSquare, MoreHorizontal, Pencil, Send, Share2, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MeetingDeleteDialog,
  MeetingHeader,
  MeetingTabs,
  SmartSummaryCard,
} from "@/components/meeting-detail";
import type { MeetingTab, MeetingTask } from "@/components/meeting-detail";
import { MeetingInlineChatPanel } from "@/components/meeting-detail/MeetingInlineChatPanel";
import { KanbanBoard, TaskEditModal } from "@/components/tasks";
import type { Task } from "@/components/tasks";
import type { DropResult } from "@hello-pangea/dnd";
import { useToast } from "@/components/upload/Toast";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/app";
import {
  createTask,
  deleteTaskById,
  updateTaskById,
} from "@/app/dashboard/tasks/tasks-api";
import { deleteMeetingById } from "./meeting-client-api";
import type { MeetingDetailData } from "./meeting-types";
import {
  buildMeetingTaskColumns,
  type MeetingTaskColumnId,
  mapBoardTaskToMeetingTask,
  setMeetingTaskStatus,
  upsertMeetingTask,
} from "./meeting-task-kanban";

// ─── AI Workspace helpers ─────────────────────────────────────────────────────

interface LocalParticipant {
  id: string;
  name: string;
  initials: string;
  isEditing: boolean;
  draftName: string;
}

interface InsightRailProps {
  participants: Array<{ name: string }>;
  onOpenChat: () => void;
}

const AI_CHIP_PROMPTS = [
  "Criar e-mail de follow-up",
  "Listar próximos passos",
  "Quais foram os riscos?",
  "Resumir para o time",
];

function MeetingInsightRail({ participants, onOpenChat }: InsightRailProps) {
  const [localParticipants, setLocalParticipants] = useState<LocalParticipant[]>(
    () =>
      participants.map((p, i) => ({
        id: String(i),
        name: p.name,
        initials: p.name.charAt(0).toUpperCase(),
        isEditing: false,
        draftName: p.name,
      }))
  );
  const [isAdding, setIsAdding] = useState(false);
  const [addDraft, setAddDraft] = useState("");
  const [aiInput, setAiInput] = useState("");

  // Mobile focus: iOS won't honour autoFocus on dynamic inputs — do it manually
  useEffect(() => {
    const editing = localParticipants.find((p) => p.isEditing);
    if (!editing) return;
    const timer = setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>(
        `[data-edit-id="${editing.id}"]`
      );
      el?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [localParticipants]);

  function startEdit(id: string) {
    setLocalParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isEditing: true, draftName: p.name } : p))
    );
  }

  function saveEdit(id: string) {
    setLocalParticipants((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const trimmed = p.draftName.trim();
        if (!trimmed) return { ...p, isEditing: false };
        return { ...p, name: trimmed, initials: trimmed.charAt(0).toUpperCase(), isEditing: false };
      })
    );
  }

  function cancelEdit(id: string) {
    setLocalParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isEditing: false, draftName: p.name } : p))
    );
  }

  function removeParticipant(id: string) {
    setLocalParticipants((prev) => prev.filter((p) => p.id !== id));
  }

  function confirmAdd() {
    const trimmed = addDraft.trim();
    if (trimmed) {
      setLocalParticipants((prev) => [
        ...prev,
        {
          id: `p-${Date.now()}`,
          name: trimmed,
          initials: trimmed.charAt(0).toUpperCase(),
          isEditing: false,
          draftName: trimmed,
        },
      ]);
    }
    setAddDraft("");
    setIsAdding(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ── Participants card ── */}
      <div className="rounded-2xl border border-border/50 bg-card/80 p-4">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Participantes
        </p>
        <div className="flex flex-col gap-1.5">
          {localParticipants.map((p) => (
            <div key={p.id} className="group flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                {p.initials}
              </div>
              {p.isEditing ? (
                <input
                  data-edit-id={p.id}
                  className="flex-1 rounded-md border border-primary/30 bg-background px-2 py-0.5 text-foreground/80 outline-none focus:border-primary/60"
                  style={{ fontSize: 16 }}
                  value={p.draftName}
                  onChange={(e) =>
                    setLocalParticipants((prev) =>
                      prev.map((x) => (x.id === p.id ? { ...x, draftName: e.target.value } : x))
                    )
                  }
                  onBlur={() => saveEdit(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); saveEdit(p.id); }
                    if (e.key === "Escape") cancelEdit(p.id);
                  }}
                />
              ) : (
                <>
                  <span
                    className="flex-1 cursor-pointer text-sm text-foreground/80"
                    onClick={() => startEdit(p.id)}
                    onTouchEnd={(e) => { e.preventDefault(); startEdit(p.id); }}
                  >
                    {p.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(p.id)}
                    className="shrink-0 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                    aria-label="Editar nome"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeParticipant(p.id)}
                    className="shrink-0 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                    aria-label="Remover participante"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </>
              )}
            </div>
          ))}
          {isAdding ? (
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                +
              </div>
              <input
                autoFocus
                className="flex-1 rounded-md border border-primary/30 bg-background px-2 py-0.5 text-foreground/80 outline-none focus:border-primary/60"
                style={{ fontSize: 16 }}
                value={addDraft}
                placeholder="Nome do participante"
                onChange={(e) => setAddDraft(e.target.value)}
                onBlur={confirmAdd}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); confirmAdd(); }
                  if (e.key === "Escape") { setIsAdding(false); setAddDraft(""); }
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="mt-1 text-left text-[11px] text-muted-foreground/60 transition-colors hover:text-muted-foreground"
            >
              + Adicionar participante
            </button>
          )}
        </div>
      </div>

      {/* ── Ask AI card ── */}
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/80">
        <div className="p-4 pb-3">
          <div className="mb-3 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary/70" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Perguntar à IA
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {AI_CHIP_PROMPTS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setAiInput(chip)}
                className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] text-primary transition-all hover:border-primary/40 hover:bg-primary/20"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
        <div className="border-t border-border/40 bg-background/40 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <input
              className="flex-1 bg-transparent text-sm text-foreground/80 outline-none placeholder:text-muted-foreground/50"
              placeholder="Pergunte sobre esta reunião..."
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && aiInput.trim()) {
                  onOpenChat();
                  setAiInput("");
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (aiInput.trim()) {
                  onOpenChat();
                  setAiInput("");
                }
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors hover:bg-primary/20"
              aria-label="Enviar pergunta"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mobile bottom action bar ────────────────────────────────────────────────

interface MobileActionsBarProps {
  meetingId: string;
  meetingStatus: "completed" | "processing" | "failed" | "scheduled";
  onBack: () => void;
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function MobileActionsBar({
  meetingId,
  meetingStatus,
  onBack,
  onShare,
  onEdit,
  onDelete,
}: MobileActionsBarProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      {/* Fixed bottom bar — mobile only */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/40 bg-background/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-stretch divide-x divide-border/40">
          <button
            type="button"
            onClick={onBack}
            className="flex flex-1 flex-col items-center gap-0.5 px-3 py-2.5 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-[10px] font-medium">Voltar</span>
          </button>

          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex flex-1 flex-col items-center gap-0.5 px-3 py-2.5 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium">Mais ações</span>
          </button>

          {meetingStatus === "completed" && (
            <button
              type="button"
              onClick={() => router.push(`/dashboard/meetings/${meetingId}/chat`)}
              className="flex flex-1 flex-col items-center gap-0.5 px-3 py-2.5 text-primary transition-colors hover:bg-primary/5"
            >
              <MessageSquare className="h-5 w-5" />
              <span className="text-[10px] font-semibold">Chat com IA</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom sheet overlay */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setSheetOpen(false)}
          />
          {/* Sheet */}
          <div
            className="sheet-slide-up absolute bottom-0 left-0 right-0 rounded-t-2xl bg-background pb-[env(safe-area-inset-bottom)] shadow-2xl"
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="h-1 w-10 rounded-full bg-border" />
            </div>

            <div className="px-4 pb-6">
              <button
                type="button"
                onClick={() => { onShare(); setSheetOpen(false); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left transition-colors hover:bg-muted/60"
              >
                <Share2 className="h-5 w-5 text-muted-foreground" />
                <span className="text-[15px] text-foreground">Compartilhar</span>
              </button>
              <button
                type="button"
                onClick={() => { onEdit(); setSheetOpen(false); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left transition-colors hover:bg-muted/60"
              >
                <Pencil className="h-5 w-5 text-muted-foreground" />
                <span className="text-[15px] text-foreground">Editar</span>
              </button>
              <div className="my-1.5 h-px bg-border/50" />
              <button
                type="button"
                onClick={() => { onDelete(); setSheetOpen(false); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-5 w-5" />
                <span className="text-[15px]">Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Not found state ──────────────────────────────────────────────────────────

function NotFoundState({ onBack }: { onBack: () => void }) {
  return (
    <SectionCard className="rounded-xl px-6 py-12 text-center">
      <p className="text-sm text-muted-foreground">Reunião não encontrada.</p>
      <Button type="button" className="mt-4 rounded-full px-6" onClick={onBack}>
        Voltar
      </Button>
    </SectionCard>
  );
}

// ─── Processing state ─────────────────────────────────────────────────────────

function ProcessingState({ clientName }: { clientName: string }) {
  return (
    <SectionCard className="rounded-xl px-6 py-12 text-center">
      <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
      <p className="text-sm font-semibold text-sky-500">Processando reunião com {clientName}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        O resumo e as tarefas serão gerados em instantes.
      </p>
    </SectionCard>
  );
}

// ─── Placeholder for coming-soon tabs ─────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="rounded-xl border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
      {label} — em breve
    </div>
  );
}

function buildInitialTaskColumnMap(
  meetingTasks: MeetingTask[]
): Record<string, MeetingTaskColumnId> {
  return meetingTasks.reduce<Record<string, MeetingTaskColumnId>>((acc, task) => {
    if (task.status === "in_progress") {
      acc[task.id] = "in_progress";
    } else if (task.status === "completed" || task.completed) {
      acc[task.id] = "completed";
    } else {
      acc[task.id] = "todo";
    }
    return acc;
  }, {});
}

function toMeetingTaskColumnId(columnId: string | undefined): MeetingTaskColumnId {
  if (columnId === "in_progress") return "in_progress";
  if (columnId === "completed" || columnId === "done") return "completed";
  return "todo";
}

export interface MeetingDetailClientProps {
  id: string;
  initialMeeting: MeetingDetailData | null;
}

const EMPTY_MEETING_DETAIL: MeetingDetailData = {
  clientName: "",
  meetingDate: "",
  meetingStatus: "processing",
  participants: [],
  summary: "",
  nextStep: "",
  keyDecision: "",
  alertPoint: "",
  transcript: null,
  location: "Reunião Online",
  tasks: [],
  files: [],
  insightMessage: "",
  decisions: [],
  openItems: [],
};

// ─── Client page ──────────────────────────────────────────────────────────────

export function MeetingDetailClient({ id, initialMeeting }: MeetingDetailClientProps) {
  const router = useRouter();
  const { show } = useToast();
  const meeting = initialMeeting ?? EMPTY_MEETING_DETAIL;

  // Meeting info
  const [clientName] = useState(meeting.clientName);
  const [meetingDate] = useState(meeting.meetingDate);
  const [meetingStatus] = useState<
    "completed" | "processing" | "failed" | "scheduled"
  >(meeting.meetingStatus);
  const [participants] = useState<Array<{ name: string }>>(meeting.participants);

  // Summary content
  const [summary] = useState(meeting.summary);
  const [nextStep] = useState(meeting.nextStep);
  const [keyDecision] = useState(meeting.keyDecision);
  const [alertPoint] = useState(meeting.alertPoint);
  const [transcript] = useState<string | null>(meeting.transcript);

  // Tasks & files
  const [tasks, setTasks] = useState<MeetingTask[]>(meeting.tasks);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draftColumnId, setDraftColumnId] = useState<string | null>(null);
  const [taskColumnById, setTaskColumnById] = useState<
    Record<string, MeetingTaskColumnId>
  >(() => buildInitialTaskColumnMap(meeting.tasks));

  const [activeTab, setActiveTab] = useState<MeetingTab>("summary");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingMeeting, setIsDeletingMeeting] = useState(false);
  const taskColumns = useMemo(
    () => buildMeetingTaskColumns(tasks, taskColumnById),
    [taskColumnById, tasks]
  );
  const taskMeetingOptions = useMemo(
    () => [{ id, label: clientName || "Reunião atual" }],
    [clientName, id]
  );

  // ─── Decisions & open items for tabs ─────────────────────────────────────
  const [decisions] = useState(meeting.decisions);
  const [openItems] = useState(meeting.openItems);

  function isDraftTask(taskId: string) {
    return taskId.startsWith("task-draft-");
  }

  const handleAddTask = useCallback((columnId: string) => {
    setDraftColumnId(columnId);
    setEditingTask({
      id: `task-draft-${Date.now()}`,
      title: "Nova tarefa",
      priority: "media",
      columnId,
      meetingId: id,
    });
  }, [id]);

  const handleSaveTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    const assigneeName = updates.assignees?.[0]?.name ?? updates.assignee?.name;

    if (isDraftTask(taskId)) {
      const draftColumn = (draftColumnId ?? "todo") as MeetingTaskColumnId;
      const persistedTask = await createTask({
        title: updates.title ?? "Nova tarefa",
        priority: updates.priority ?? "media",
        dueDate: updates.dueDate,
        assigneeName,
        columnId: draftColumn,
        meetingId: id,
      });
      const persistedColumnId = persistedTask.columnId as MeetingTaskColumnId;
      setTasks((prev) =>
        upsertMeetingTask(prev, mapBoardTaskToMeetingTask(persistedTask))
      );
      setTaskColumnById((prev) => ({
        ...prev,
        [persistedTask.id]: toMeetingTaskColumnId(persistedColumnId) ?? draftColumn,
      }));
      setDraftColumnId(null);
      return;
    }

    const persistedTask = await updateTaskById(taskId, {
      title: updates.title,
      priority: updates.priority,
      dueDate: updates.dueDate,
      assigneeName,
    });
    setTasks((prev) =>
      upsertMeetingTask(prev, mapBoardTaskToMeetingTask(persistedTask))
    );
    setTaskColumnById((prev) => ({
      ...prev,
      [taskId]: toMeetingTaskColumnId(persistedTask.columnId),
    }));
  }, [draftColumnId, id]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    if (isDraftTask(taskId)) {
      setDraftColumnId(null);
      return;
    }

    await deleteTaskById(taskId);
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    setTaskColumnById((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  }, []);

  const handleTaskBoardDragEnd = useCallback(
    async (result: DropResult) => {
      const { source, destination, type } = result;
      if (!destination || type === "COLUMN") return;
      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      ) {
        return;
      }

      if (source.droppableId === destination.droppableId) {
        return;
      }

      const movedTaskId = result.draggableId;
      if (!movedTaskId) return;

      const task = tasks.find((item) => item.id === movedTaskId);
      if (!task) return;

      const destinationColumnId = toMeetingTaskColumnId(destination.droppableId);
      const previousColumnId =
        taskColumnById[movedTaskId] ?? toMeetingTaskColumnId(source.droppableId);

      setTaskColumnById((prev) => ({
        ...prev,
        [movedTaskId]: destinationColumnId,
      }));
      setTasks((prev) => setMeetingTaskStatus(prev, movedTaskId, destinationColumnId));

      try {
        const persistedTask = await updateTaskById(movedTaskId, { status: destinationColumnId });
        setTasks((prev) =>
          upsertMeetingTask(prev, mapBoardTaskToMeetingTask(persistedTask))
        );
        setTaskColumnById((prev) => ({
          ...prev,
          [movedTaskId]: toMeetingTaskColumnId(persistedTask.columnId),
        }));
      } catch {
        setTasks((prev) => prev.map((item) => (item.id === task.id ? task : item)));
        setTaskColumnById((prev) => ({
          ...prev,
          [movedTaskId]: previousColumnId,
        }));
        show("Erro ao atualizar tarefa.", "error");
      }
    },
    [show, taskColumnById, tasks]
  );

  const handleShare = useCallback(() => {
    navigator.clipboard
      .writeText(window.location.href)
      .catch(() => {})
      .finally(() => show("Link copiado para a área de transferência.", "success"));
  }, [show]);

  const handleExport = useCallback(async () => {
    show("Gerando exportação...", "warning");
    try {
      await fetch(`/api/meetings/${id}/export`, { method: "POST" });
      show("Exportação gerada com sucesso.", "success");
    } catch {
      show("Erro ao exportar. Tente novamente.", "error");
    }
  }, [id, show]);

  const handleCopySummaryForDelete = useCallback(() => {
    show("Resumo inteligente copiado para a area de transferencia.", "success");
  }, [show]);

  const handleDeleteMeeting = useCallback(async () => {
    setIsDeletingMeeting(true);

    try {
      await deleteMeetingById(id);
      show("Reuniao excluida com sucesso.", "success");
      router.replace("/dashboard/meetings");
      router.refresh();
    } catch (error) {
      show(
        error instanceof Error ? error.message : "Erro ao excluir reuniao.",
        "error"
      );
    } finally {
      setIsDeletingMeeting(false);
      setIsDeleteDialogOpen(false);
    }
  }, [id, router, show]);

  // ─── Main content per active tab ──────────────────────────────────────────
  function renderMainContent() {
    if (meetingStatus !== "completed") {
      return <ProcessingState clientName={clientName} />;
    }

    switch (activeTab) {
      case "summary":
        return (
          <SmartSummaryCard
            summary={summary || "Resumo não disponível."}
            nextSteps={nextStep}
            onCopyToWhatsApp={() =>
              show("Resumo copiado para WhatsApp!", "success")
            }
          />
        );

      case "transcript":
        return transcript ? (
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Transcrição
            </p>
            <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-foreground/80">
              {transcript}
            </pre>
          </div>
        ) : (
          <ComingSoon label="Transcrição" />
        );

      case "tasks":
        return (
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Tarefas ({tasks.length})
            </p>
            <KanbanBoard
              columns={taskColumns}
              onDragEnd={handleTaskBoardDragEnd}
              onAddTask={handleAddTask}
              onEditTask={setEditingTask}
              onDeleteColumn={() => {}}
              onAddColumn={() => {}}
              allowColumnManagement={false}
            />
          </div>
        );

      case "decisions":
        return decisions.length > 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Decisões ({decisions.length})
            </p>
            <div className="flex flex-col gap-2.5">
              {decisions.map((d) => (
                <div
                  key={d.id}
                  className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3"
                >
                  <p className="text-[13px] text-foreground">{d.description}</p>
                  {d.decided_by && (
                    <p className="mt-1 text-[11px] text-primary/60">Por: {d.decided_by}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <ComingSoon label="Decisões" />
        );

      case "pending":
        return openItems.length > 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Pendências ({openItems.length})
            </p>
            <div className="flex flex-col gap-2.5">
              {openItems.map((o) => (
                <div
                  key={o.id}
                  className="rounded-xl border border-amber-400/25 bg-amber-50/50 px-4 py-3 dark:bg-amber-950/15"
                >
                  <p className="text-[13px] text-foreground">{o.description}</p>
                  {o.context && (
                    <p className="mt-1 text-[11px] text-amber-600/70">{o.context}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <ComingSoon label="Pendências" />
        );
    }
  }

  if (!initialMeeting) {
    return <NotFoundState onBack={() => router.push("/dashboard")} />;
  }

  return (
    <>
      <style>{`
        @keyframes fade-slide-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes chat-slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes sheet-slide-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .anim-in {
          animation: fade-slide-up 0.22s ease-out forwards;
          opacity: 0;
        }
        .chat-panel-anim {
          animation: chat-slide-in 0.25s ease forwards;
        }
        .sheet-slide-up {
          animation: sheet-slide-up 0.25s ease forwards;
        }
      `}</style>

      {/* ── Workspace layout: main content + optional inline chat ── */}
      <div className={cn("flex items-start", isChatOpen ? "gap-4 pb-4 md:pb-4" : "gap-6 pb-20 md:pb-6")}>

        {/* ── Primary content column ─────────────────────────────── */}
        <div className="min-w-0 flex-1">
          <div className="anim-in" style={{ animationDelay: "0ms" }}>
            <MeetingHeader
              breadcrumbs={[
                { label: "Dashboard", href: "/dashboard" },
                { label: "Reuniões", href: "/dashboard/meetings" },
                { label: "Detalhes" },
              ]}
              clientName={clientName}
              date={meetingDate}
              status={meetingStatus}
              participants={participants}
              onChat={
                meetingStatus === "completed"
                  ? () => setIsChatOpen((v) => !v)
                  : undefined
              }
              onShare={handleShare}
              onEdit={() => router.push(`/dashboard/meetings/${id}/edit`)}
              onDelete={() => setIsDeleteDialogOpen(true)}
            />
          </div>

          <div className="anim-in mt-5" style={{ animationDelay: "40ms" }}>
            <MeetingTabs activeTab={activeTab} onChange={setActiveTab} />
          </div>

          <div className="anim-in" style={{ animationDelay: "80ms", minWidth: 0 }}>
            {renderMainContent()}
          </div>
        </div>

        {/* ── Right insight rail (hidden when chat open on xl) ────── */}
        {activeTab === "summary" && meetingStatus === "completed" && !isChatOpen && (
          <aside
            className="anim-in hidden w-72 shrink-0 xl:block"
            style={{ animationDelay: "100ms", position: "sticky", top: "1.5rem" }}
          >
            <MeetingInsightRail
              participants={participants}
              onOpenChat={() => setIsChatOpen(true)}
            />
          </aside>
        )}

        {/* ── Desktop inline chat panel (xl+) ─────────────────────── */}
        {isChatOpen && (
          <aside
            className="chat-panel-anim hidden xl:flex xl:w-[340px] xl:shrink-0"
            style={{ position: "sticky", top: 0, height: "100vh" }}
          >
            <MeetingInlineChatPanel
              meetingName={clientName}
              onClose={() => setIsChatOpen(false)}
            />
          </aside>
        )}
      </div>

      {/* ── Tablet overlay chat (md → xl) ──────────────────── */}
      {isChatOpen && (
        <div
          role="dialog"
          aria-label="Chat com IA"
          aria-modal="true"
          className="fixed inset-0 z-40 hidden md:block xl:hidden"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setIsChatOpen(false)}
          />
          <div className="chat-panel-anim absolute bottom-0 right-0 top-0 w-full max-w-[340px] shadow-2xl">
            <MeetingInlineChatPanel
              meetingName={clientName}
              onClose={() => setIsChatOpen(false)}
            />
          </div>
        </div>
      )}

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          meetings={taskMeetingOptions}
          onSave={(taskId, updates) => {
            void handleSaveTask(taskId, updates).catch(() => {
              show("Erro ao salvar tarefa.", "error");
            });
          }}
          onDelete={(taskId) => {
            void handleDeleteTask(taskId).catch(() => {
              show("Erro ao excluir tarefa.", "error");
            });
          }}
          onClose={() => {
            setEditingTask(null);
            setDraftColumnId(null);
          }}
        />
      )}

      {/* ── Mobile bottom action bar ────────────────────────── */}
      <MobileActionsBar
        meetingId={id}
        meetingStatus={meetingStatus}
        onBack={() => router.push("/dashboard/meetings")}
        onShare={handleShare}
        onEdit={() => router.push(`/dashboard/meetings/${id}/edit`)}
        onDelete={() => setIsDeleteDialogOpen(true)}
      />

      <MeetingDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        meetingName={clientName}
        summary={summary}
        isDeleting={isDeletingMeeting}
        onCopySummary={handleCopySummaryForDelete}
        onConfirmDelete={handleDeleteMeeting}
      />
    </>
  );
}
