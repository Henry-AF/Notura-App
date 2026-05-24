"use client";
/* eslint-disable max-lines-per-function, complexity */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MeetingDeleteDialog,
  MeetingHeader,
  MeetingTabs,
  MeetingParticipantsEditorCard,
  SmartSummaryCard,
  KeyDecisionCard,
  AlertPointCard,
  MeetingChatSheet,
} from "@/components/meeting-detail";
import type { MeetingTab, MeetingTask } from "@/components/meeting-detail";
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
import {
  cancelMeetingProcessing,
  deleteMeetingById,
  fetchMeetingStatus,
  retryMeetingProcessing,
  updateMeetingParticipantDisplayName,
} from "./meeting-client-api";
import { resolveSummary } from "./meeting-summary-resolver";
import type { MeetingDetailData, MeetingParticipantDisplay } from "./meeting-types";
import {
  buildMeetingTaskColumns,
  type MeetingTaskColumnId,
  mapBoardTaskToMeetingTask,
  setMeetingTaskStatus,
  upsertMeetingTask,
} from "./meeting-task-kanban";

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

function ProcessingState({
  clientName,
  isCancelingProcessing,
  onCancelProcessing,
}: {
  clientName: string;
  isCancelingProcessing: boolean;
  onCancelProcessing: () => void;
}) {
  return (
    <SectionCard className="rounded-xl px-6 py-12 text-center">
      <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
      <p className="text-sm font-semibold text-sky-500">Processando reunião com {clientName}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        O resumo e as tarefas serão gerados em instantes.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onCancelProcessing}
        disabled={isCancelingProcessing}
        className="mt-4 border-destructive/40 text-destructive hover:bg-destructive/10"
      >
        {isCancelingProcessing ? "Cancelando..." : "Cancelar processamento"}
      </Button>
    </SectionCard>
  );
}

// ─── Failed state ─────────────────────────────────────────────────────────────

function FailedState({ onRetry, isRetrying }: { onRetry: () => void; isRetrying: boolean }) {
  return (
    <SectionCard className="rounded-xl px-6 py-12 text-center">
      <p className="text-sm font-semibold text-destructive">Falha no processamento</p>
      <p className="mt-1 text-xs text-muted-foreground">
        O arquivo foi salvo. Clique em &quot;Reprocessar&quot; no cabeçalho para tentar novamente.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRetry}
        disabled={isRetrying}
        className="mt-4 border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950"
      >
        {isRetrying ? "Reprocessando..." : "Reprocessar"}
      </Button>
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
  entities: [],
  summary: "",
  summaryStructured: null,
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
  const [meetingStatus, setMeetingStatus] = useState<
    "completed" | "processing" | "failed" | "scheduled"
  >(meeting.meetingStatus);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isCancelingProcessing, setIsCancelingProcessing] = useState(false);
  const [detectedParticipants, setDetectedParticipants] = useState<
    MeetingParticipantDisplay[]
  >(meeting.participants);
  const [detectedEntities, setDetectedEntities] = useState<
    MeetingParticipantDisplay[]
  >(meeting.entities);

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
  const resolvedSummary = useMemo(
    () =>
      resolveSummary(
        meeting.summaryStructured,
        [...detectedParticipants, ...detectedEntities],
        summary
      ),
    [detectedEntities, detectedParticipants, meeting.summaryStructured, summary]
  );
  const hasEditableNames =
    detectedParticipants.some((participant) => participant.id) ||
    detectedEntities.some((entity) => entity.id);

  // ─── Polling: refresh status every 30s while processing ──────────────────
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (meetingStatus !== "processing") return;

    pollingRef.current = setInterval(() => {
      void (async () => {
        try {
          const result = await fetchMeetingStatus(id);
          if (result.status !== "processing") {
            window.location.reload();
          }
        } catch {
          // silent — will retry on next interval
        }
      })();
    }, 30_000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [id, meetingStatus]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await retryMeetingProcessing(id);
      setMeetingStatus("processing");
      show("Reunião colocada em fila de reprocessamento.", "success");
    } catch (error) {
      show(
        error instanceof Error ? error.message : "Erro ao reprocessar reunião.",
        "error"
      );
    } finally {
      setIsRetrying(false);
    }
  }, [id, show]);

  const handleCancelProcessing = useCallback(async () => {
    setIsCancelingProcessing(true);
    try {
      await cancelMeetingProcessing(id);
      setMeetingStatus("failed");
      show("Processamento cancelado. Você pode reprocessar depois.", "success");
    } catch (error) {
      show(
        error instanceof Error
          ? error.message
          : "Erro ao cancelar processamento.",
        "error"
      );
    } finally {
      setIsCancelingProcessing(false);
    }
  }, [id, show]);

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
        [persistedTask.id]: toMeetingTaskColumnId(persistedColumnId),
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

  const updateParticipantDisplayName = useCallback(
    async (participantId: string, displayName: string) => {
      const updated = await updateMeetingParticipantDisplayName(
        id,
        participantId,
        displayName
      );

      if (updated.role === "entity") {
        setDetectedEntities((prev) =>
          prev.map((entity) => entity.id === updated.id ? updated : entity)
        );
      } else {
        setDetectedParticipants((prev) =>
          prev.map((participant) =>
            participant.id === updated.id ? updated : participant
          )
        );
      }

      show("Nome atualizado no resumo.", "success");
      return updated;
    },
    [id, show]
  );

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
    if (meetingStatus === "processing") {
      return (
        <ProcessingState
          clientName={clientName}
          isCancelingProcessing={isCancelingProcessing}
          onCancelProcessing={() => { void handleCancelProcessing(); }}
        />
      );
    }
    if (meetingStatus === "failed") {
      return (
        <FailedState
          onRetry={() => { void handleRetry(); }}
          isRetrying={isRetrying}
        />
      );
    }
    if (meetingStatus !== "completed") {
      return (
        <ProcessingState
          clientName={clientName}
          isCancelingProcessing={isCancelingProcessing}
          onCancelProcessing={() => { void handleCancelProcessing(); }}
        />
      );
    }

    switch (activeTab) {
      case "summary": {
        const hasSummarySidebar = hasEditableNames || keyDecision || alertPoint;
        return (
          <div
            className="summary-layout anim-in"
            style={{
              display: "grid",
              gridTemplateColumns:
                hasSummarySidebar
                  ? "minmax(0, 1.9fr) minmax(240px, 1fr)"
                  : "1fr",
              gap: 16,
              alignItems: "start",
              animationDelay: "120ms",
            }}
          >
            <SmartSummaryCard
              summary={resolvedSummary || "Resumo não disponível."}
              nextSteps={nextStep}
              onCopyToWhatsApp={() =>
                show("Resumo copiado para WhatsApp!", "success")
              }
            />
            {hasSummarySidebar && (
              <div
                className="decision-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 16,
                }}
              >
                {hasEditableNames && (
                  <MeetingParticipantsEditorCard
                    participants={detectedParticipants}
                    entities={detectedEntities}
                    onSaveDisplayName={updateParticipantDisplayName}
                    onError={(message) => show(message, "error")}
                  />
                )}
                {keyDecision && <KeyDecisionCard decision={keyDecision} />}
                {alertPoint && <AlertPointCard alert={alertPoint} />}
              </div>
            )}
          </div>
        );
      }

      case "transcript":
        return transcript ? (
          <div
            style={{
              background: "rgb(var(--cn-card))",
              border: "1px solid rgb(var(--cn-border))",
              borderRadius: 14,
              padding: "24px",
            }}
          >
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "rgb(var(--cn-muted))",
                marginBottom: 16,
              }}
            >
              Transcrição
            </p>
            <pre
              style={{
                fontFamily: "Inter, monospace",
                fontSize: 13,
                color: "rgb(var(--cn-ink2))",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
                lineHeight: 1.7,
              }}
            >
              {transcript}
            </pre>
          </div>
        ) : (
          <ComingSoon label="Transcrição" />
        );

      case "tasks":
        return (
          <div
            style={{
              background: "rgb(var(--cn-card))",
              border: "1px solid rgb(var(--cn-border))",
              borderRadius: 14,
              padding: "24px",
            }}
          >
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "rgb(var(--cn-muted))",
                marginBottom: 16,
              }}
            >
              Tarefas ({tasks.length})
            </p>
            <KanbanBoard
              columns={taskColumns}
              onDragEnd={(result) => { void handleTaskBoardDragEnd(result); }}
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
          <div
            style={{
              background: "rgb(var(--cn-card))",
              border: "1px solid rgb(var(--cn-border))",
              borderRadius: 14,
              padding: "24px",
            }}
          >
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "rgb(var(--cn-muted))",
                marginBottom: 16,
              }}
            >
              Decisões ({decisions.length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {decisions.map((d) => (
                <div
                  key={d.id}
                  style={{
                    padding: "12px 14px",
                    background: "rgba(108,92,231,0.07)",
                    border: "1px solid rgba(108,92,231,0.2)",
                    borderRadius: 8,
                  }}
                >
                  <p
                    style={{ fontSize: 13, color: "rgb(var(--cn-ink))", margin: 0 }}
                  >
                    {d.description}
                  </p>
                  {d.decided_by && (
                    <p
                      style={{
                        fontSize: 11,
                        color: "#A29BFE",
                        margin: "4px 0 0",
                      }}
                    >
                      Por: {d.decided_by}
                    </p>
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
          <div
            style={{
              background: "rgb(var(--cn-card))",
              border: "1px solid rgb(var(--cn-border))",
              borderRadius: 14,
              padding: "24px",
            }}
          >
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "rgb(var(--cn-muted))",
                marginBottom: 16,
              }}
            >
              Pendências ({openItems.length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {openItems.map((o) => (
                <div
                  key={o.id}
                  style={{
                    padding: "12px 14px",
                    background: "rgba(255,169,77,0.07)",
                    border: "1px solid rgba(255,169,77,0.2)",
                    borderRadius: 8,
                  }}
                >
                  <p
                    style={{ fontSize: 13, color: "rgb(var(--cn-ink))", margin: 0 }}
                  >
                    {o.description}
                  </p>
                  {o.context && (
                    <p
                      style={{
                        fontSize: 11,
                        color: "#FFA94D",
                        margin: "4px 0 0",
                      }}
                    >
                      {o.context}
                    </p>
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
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim-in {
          animation: fade-slide-up 0.25s ease-out forwards;
          opacity: 0;
        }
        @media (max-width: 980px) {
          .summary-layout {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 480px) {
          .decision-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

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
          participants={detectedParticipants}
          onRetry={
            meetingStatus === "failed"
              ? () => { void handleRetry(); }
              : undefined
          }
          isRetrying={isRetrying}
          onCancelProcessing={
            meetingStatus === "processing"
              ? () => { void handleCancelProcessing(); }
              : undefined
          }
          isCancelingProcessing={isCancelingProcessing}
          onChat={
            meetingStatus === "completed" ? () => setIsChatOpen(true) : undefined
          }
          onShare={handleShare}
          onEdit={() => router.push(`/dashboard/meetings/${id}/edit`)}
          onDelete={() => setIsDeleteDialogOpen(true)}
        />
      </div>

      {/* Tabs */}
      <div className="anim-in mt-6" style={{ animationDelay: "40ms" }}>
        <MeetingTabs activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div style={{ minWidth: 0 }}>
        {renderMainContent()}
      </div>

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

      <MeetingDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        meetingName={clientName}
        summary={resolvedSummary}
        isDeleting={isDeletingMeeting}
        onCopySummary={handleCopySummaryForDelete}
        onConfirmDelete={handleDeleteMeeting}
      />

      {meetingStatus === "completed" && (
        <MeetingChatSheet
          meetingId={id}
          open={isChatOpen}
          onOpenChange={setIsChatOpen}
        />
      )}

      {/* Export button via a portal-like approach — rendered as fixed button
          top-right to supplement the existing topbar */}
      <div
        style={{
          position: "fixed",
          top: 12,
          right: 16,
          zIndex: 50,
          display: "none", // Hidden; export button is in topbar slot via layout
        }}
      >
        <button
          type="button"
          onClick={() => { void handleExport(); }}
          style={{
            background: "#6C5CE7",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 999,
            padding: "10px 24px",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Exportar
        </button>
      </div>
    </>
  );
}
