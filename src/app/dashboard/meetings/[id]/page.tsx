"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MeetingBreadcrumb,
  MeetingHeader,
  MeetingTabs,
  SmartSummaryCard,
  KeyDecisionCard,
  AlertPointCard,
  MeetingTasksSidebar,
  MeetingLocationCard,
  MeetingFilesCard,
  AIInsightToast,
  AIFloatingButton,
} from "@/components/meeting-detail";
import type { MeetingTab, MeetingTask, MeetingFile } from "@/components/meeting-detail";
import { KanbanBoard } from "@/components/tasks";
import type { DropResult } from "@hello-pangea/dnd";
import { ToastProvider, useToast } from "@/components/upload/Toast";
import { updateTaskById } from "@/app/dashboard/tasks/tasks-api";
import { fetchMeetingDetail } from "./meeting-api";
import {
  buildMeetingTaskColumns,
  setMeetingTaskCompletion,
} from "./meeting-task-kanban";

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 240,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "2px solid #6C5CE7",
          borderTopColor: "transparent",
          animation: "spin 0.7s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Not found state ──────────────────────────────────────────────────────────

function NotFoundState({ onBack }: { onBack: () => void }) {
  return (
    <div
      style={{
        background: "rgb(var(--cn-card))",
        border: "1px solid rgb(var(--cn-border))",
        borderRadius: 14,
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <p style={{ color: "rgb(var(--cn-ink2))", fontFamily: "Inter, sans-serif", fontSize: 14 }}>
        Reunião não encontrada.
      </p>
      <button
        type="button"
        onClick={onBack}
        style={{
          marginTop: 16,
          background: "#6C5CE7",
          color: "#fff",
          border: "none",
          borderRadius: 999,
          padding: "8px 20px",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Voltar
      </button>
    </div>
  );
}

// ─── Processing state ─────────────────────────────────────────────────────────

function ProcessingState({ clientName }: { clientName: string }) {
  return (
    <div
      style={{
        background: "rgb(var(--cn-card))",
        border: "1px solid rgb(var(--cn-border))",
        borderRadius: 14,
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "2px solid #74C0FC",
          borderTopColor: "transparent",
          animation: "spin 0.7s linear infinite",
          margin: "0 auto 16px",
        }}
      />
      <p style={{ color: "#74C0FC", fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 600 }}>
        Processando reunião com {clientName}
      </p>
      <p style={{ color: "rgb(var(--cn-muted))", fontFamily: "Inter, sans-serif", fontSize: 13, marginTop: 6 }}>
        O resumo e as tarefas serão gerados em instantes.
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Placeholder for coming-soon tabs ─────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
  return (
    <div
      style={{
        background: "rgb(var(--cn-card))",
        border: "1px solid rgb(var(--cn-border))",
        borderRadius: 14,
        padding: "48px 24px",
        textAlign: "center",
        color: "rgb(var(--cn-muted))",
        fontFamily: "Inter, sans-serif",
        fontSize: 14,
      }}
    >
      {label} — em breve
    </div>
  );
}

// ─── Inner page ───────────────────────────────────────────────────────────────

function MeetingDetailInner({ id }: { id: string }) {
  const router = useRouter();
  const { show } = useToast();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Meeting info
  const [clientName, setClientName] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingStatus, setMeetingStatus] = useState<
    "completed" | "processing" | "failed" | "scheduled"
  >("processing");
  const [participants, setParticipants] = useState<Array<{ name: string }>>([]);

  // Summary content
  const [summary, setSummary] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [keyDecision, setKeyDecision] = useState("");
  const [alertPoint, setAlertPoint] = useState("");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [location, setLocation] = useState("Reunião Online");

  // Tasks & files
  const [tasks, setTasks] = useState<MeetingTask[]>([]);
  const [files, setFiles] = useState<MeetingFile[]>([]);
  const [insightMessage, setInsightMessage] = useState("");

  const [activeTab, setActiveTab] = useState<MeetingTab>("summary");
  const taskColumns = useMemo(() => buildMeetingTaskColumns(tasks), [tasks]);

  // ─── Decisions & open items for tabs ─────────────────────────────────────
  const [decisions, setDecisions] = useState<Array<{ id: string; description: string; decided_by: string | null; confidence: string }>>([]);
  const [openItems, setOpenItems] = useState<Array<{ id: string; description: string; context: string | null }>>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const meeting = await fetchMeetingDetail(id);
        if (cancelled) return;

        setClientName(meeting.clientName);
        setMeetingDate(meeting.meetingDate);
        setMeetingStatus(meeting.meetingStatus);
        setParticipants(meeting.participants);
        setSummary(meeting.summary);
        setNextStep(meeting.nextStep);
        setKeyDecision(meeting.keyDecision);
        setAlertPoint(meeting.alertPoint);
        setTranscript(meeting.transcript);
        setLocation(meeting.location);
        setTasks(meeting.tasks);
        setFiles(meeting.files);
        setInsightMessage(meeting.insightMessage);
        setDecisions(meeting.decisions);
        setOpenItems(meeting.openItems);
      } catch {
        if (!cancelled) {
          setNotFound(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleToggleTask = useCallback(
    async (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      const newCompleted = !task.completed;
      setTasks((prev) => setMeetingTaskCompletion(prev, taskId, newCompleted));
      try {
        await updateTaskById(taskId, { completed: newCompleted });
      } catch {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? task : t)));
        show("Erro ao atualizar tarefa.", "error");
      }
    },
    [tasks, show]
  );

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

      const sourceColumn = taskColumns.find((column) => column.id === source.droppableId);
      const movedTask = sourceColumn?.tasks[source.index];
      if (!movedTask) return;

      const task = tasks.find((item) => item.id === movedTask.id);
      if (!task) return;

      const newCompleted = destination.droppableId === "done";
      if (task.completed === newCompleted) return;

      setTasks((prev) => setMeetingTaskCompletion(prev, movedTask.id, newCompleted));

      try {
        await updateTaskById(movedTask.id, { completed: newCompleted });
      } catch {
        setTasks((prev) => prev.map((item) => (item.id === task.id ? task : item)));
        show("Erro ao atualizar tarefa.", "error");
      }
    },
    [show, taskColumns, tasks]
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

  const handleOpenFile = useCallback((file: MeetingFile) => {
    if (file.url && file.url !== "#") window.open(file.url, "_blank");
  }, []);

  // ─── Main content per active tab ──────────────────────────────────────────
  function renderMainContent() {
    if (meetingStatus !== "completed") {
      return <ProcessingState clientName={clientName} />;
    }

    switch (activeTab) {
      case "summary":
        return (
          <>
            <div className="anim-in" style={{ animationDelay: "120ms" }}>
              <SmartSummaryCard
                summary={summary || "Resumo não disponível."}
                nextSteps={nextStep}
                onCopyToWhatsApp={() =>
                  show("Resumo copiado para WhatsApp!", "success")
                }
              />
            </div>
            {(keyDecision || alertPoint) && (
              <div
                className="anim-in"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 16,
                  marginTop: 16,
                  animationDelay: "180ms",
                }}
              >
                {keyDecision && <KeyDecisionCard decision={keyDecision} />}
                {alertPoint && <AlertPointCard alert={alertPoint} />}
              </div>
            )}
          </>
        );

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
        return tasks.length > 0 ? (
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
              onDragEnd={handleTaskBoardDragEnd}
              onAddTask={() => show("Criação de tarefas em breve.", "warning")}
              onEditTask={(task) => {
                void handleToggleTask(task.id);
              }}
              onDeleteColumn={() => {}}
              onAddColumn={() => {}}
              allowColumnManagement={false}
            />
          </div>
        ) : (
          <ComingSoon label="Tarefas" />
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

  if (loading) return <LoadingState />;
  if (notFound) return <NotFoundState onBack={() => router.push("/dashboard")} />;

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
        @media (min-width: 1100px) {
          .meeting-detail-grid {
            grid-template-columns: 1fr 320px !important;
          }
        }
        @media (max-width: 480px) {
          .decision-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Breadcrumb */}
      <div className="anim-in" style={{ animationDelay: "0ms" }}>
        <MeetingBreadcrumb
          clientName={clientName}
          onBack={() => router.push("/dashboard")}
        />
      </div>

      {/* Header */}
      <div className="anim-in" style={{ animationDelay: "40ms" }}>
        <MeetingHeader
          clientName={clientName}
          date={meetingDate}
          status={meetingStatus}
          participants={participants}
          onShare={handleShare}
          onEdit={() => router.push(`/dashboard/meetings/${id}/edit`)}
        />
      </div>

      {/* Tabs */}
      <div className="anim-in" style={{ animationDelay: "80ms" }}>
        <MeetingTabs activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* Two-column grid */}
      <div
        className="meeting-detail-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Left column: main content */}
        <div style={{ minWidth: 0 }}>
          {renderMainContent()}
        </div>

        {/* Right column: sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0, minWidth: 0 }}>
          {/* Tasks */}
          <div className="anim-in" style={{ animationDelay: "100ms" }}>
            <MeetingTasksSidebar
              tasks={tasks}
              onToggle={handleToggleTask}
              onAddTask={() => show("Funcionalidade em breve.", "warning")}
            />
          </div>

          {/* Location */}
          <div className="anim-in" style={{ animationDelay: "160ms" }}>
            <MeetingLocationCard location={location} />
          </div>

          {/* Files */}
          <div className="anim-in" style={{ animationDelay: "200ms" }}>
            <MeetingFilesCard
              files={files}
              onViewAll={() => router.push(`/dashboard/meetings/${id}/files`)}
              onOpenFile={handleOpenFile}
            />
          </div>
        </div>
      </div>

      {/* AI Insight Toast (fixed bottom-left in sidebar area) */}
      <AIInsightToast userInitials="HT" message={insightMessage} />

      {/* FAB */}
      <AIFloatingButton
        onClick={() => show("Assistente IA em breve.", "warning")}
        tooltip="Assistente Notura"
      />

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
          onClick={handleExport}
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

// ─── Page export ──────────────────────────────────────────────────────────────

export default function MeetingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <ToastProvider>
      <MeetingDetailInner id={params.id} />
    </ToastProvider>
  );
}
