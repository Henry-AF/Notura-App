"use client";

import React, { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  MessageSquareText,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EmptyState,
  FilterBar,
  PageHeader,
  PageShell,
  SectionCard,
} from "@/components/ui/app";
import { MeetingArchivedChatsSheet } from "@/components/meeting-detail";
import { cn, getInitials } from "@/lib/utils";
import type {
  AiChatItem,
  AiChatMeetingOption,
  AiChatQuota,
  AiChatsPageData,
} from "./ai-chats-types";
import { deleteAiChat } from "./ai-chats-client-api";
import { filterAiChatsByMeeting } from "./ai-chats-utils";

interface AiChatsClientProps {
  initialData: AiChatsPageData;
}

function formatChatFallback(reason: string | null): string {
  if (reason === "low_similarity")
    return "Não encontrei essa informação na transcrição desta reunião.";
  if (reason === "not_confirmed_by_model")
    return "Encontrei trechos relacionados, mas eles não confirmam a resposta com segurança.";
  if (reason === "meeting_not_ready")
    return "A reunião ainda estava em processamento quando este chat foi criado.";
  if (reason === "no_transcript")
    return "Esta reunião não possuía transcrição disponível para consulta.";
  return "Não foi possível responder esta pergunta.";
}

function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function buildMeetingOptions(chats: AiChatItem[]): AiChatMeetingOption[] {
  const optionsByMeeting = new Map<string, AiChatMeetingOption>();

  for (const chat of chats) {
    const option = optionsByMeeting.get(chat.meetingId);
    if (option) option.count += 1;
    else optionsByMeeting.set(chat.meetingId, {
      id: chat.meetingId,
      label: chat.meetingTitle,
      count: 1,
    });
  }

  return Array.from(optionsByMeeting.values());
}

function QuotaCard({ quota }: { quota: AiChatQuota }) {
  return (
    <section className="overflow-hidden rounded-xl bg-gradient-to-br from-[#5341CD] via-[#6851FF] to-[#8B7AFF] p-5 text-white shadow-glow">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/75">
            <Sparkles className="h-4 w-4" />
            Cota diária de IA
          </div>
          <div className="mt-3 flex items-end gap-2">
            <span className="font-display text-4xl font-bold leading-none">
              {quota.used}
            </span>
            <span className="pb-1 text-sm font-medium text-white/80">
              de {quota.limit} chats usados
            </span>
          </div>
          <p className="mt-2 text-sm text-white/80">
            {quota.remaining} {quota.remaining === 1 ? "chat restante" : "chats restantes"} hoje
          </p>
        </div>

        <div className="w-full min-w-[180px] sm:w-64">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-white/75">
            <span>Uso</span>
            <span>{quota.percentage}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.7)] transition-all duration-500"
              style={{ width: `${quota.percentage}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function MeetingFilter({
  selectedMeetingId,
  meetingOptions,
  onChange,
}: {
  selectedMeetingId: string;
  meetingOptions: AiChatMeetingOption[];
  onChange: (meetingId: string) => void;
}) {
  const selected = meetingOptions.find((option) => option.id === selectedMeetingId);
  const label = selected?.label ?? "Todas as reuniões";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="min-w-[210px] justify-between rounded-xl">
          <span className="truncate" title={label}>{label}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 rounded-xl">
        <DropdownMenuLabel>Filtrar por reunião</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={selectedMeetingId} onValueChange={onChange}>
          <DropdownMenuRadioItem value="all" title="Todas as reuniões">
            Todas as reuniões
          </DropdownMenuRadioItem>
          {meetingOptions.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id} title={option.label}>
              <span className="min-w-0 flex-1 truncate" title={option.label}>{option.label}</span>
              <span className="ml-2 text-xs text-muted-foreground">{option.count}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ChatStatusPill({ chat }: { chat: AiChatItem }) {
  if (chat.status === "failed") {
    return (
      <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive">
        Falhou
      </span>
    );
  }

  if (chat.modelConfirmed) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">
        Respondido
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
      Sem confirmação
    </span>
  );
}

function ChatRow({
  chat,
  active,
  onOpen,
  onDelete,
}: {
  chat: AiChatItem;
  active: boolean;
  onOpen: (chat: AiChatItem) => void;
  onDelete: (chat: AiChatItem) => void;
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(chat)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen(chat);
      }}
      className={cn(
        "grid cursor-pointer gap-3 rounded-xl px-3 py-3.5 transition-all duration-200 sm:grid-cols-[1fr_160px_128px_48px] sm:items-center",
        active ? "bg-primary/10 shadow-sm" : "hover:bg-accent/45"
      )}
    >
      <div className="flex min-w-0 gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback name={chat.meetingTitle} className="bg-primary/10 text-xs font-semibold text-primary">
            {getInitials(chat.meetingTitle)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {chat.meetingTitle}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {chat.question}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" />
        <span>{formatDateTime(chat.createdAt)}</span>
      </div>

      <ChatStatusPill chat={chat} />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 w-9 justify-self-end rounded-lg p-0 text-muted-foreground hover:text-destructive"
        aria-label="Excluir chat"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(chat);
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </article>
  );
}

function DeleteChatDialog({
  chat,
  deleting,
  onOpenChange,
  onConfirm,
}: {
  chat: AiChatItem | null;
  deleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={Boolean(chat)} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Excluir chat?</DialogTitle>
          <DialogDescription>
            O histórico desta pergunta e resposta será removido da reunião.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={deleting}>
            <Trash2 className="h-4 w-4" />
            {deleting ? "Excluindo..." : "Excluir chat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AiChatsListSection({
  chats,
  selectedChatId,
  selectedMeetingId,
  onOpenChat,
  onDeleteChat,
}: {
  chats: AiChatItem[];
  selectedChatId: string | null;
  selectedMeetingId: string;
  onOpenChat: (chat: AiChatItem) => void;
  onDeleteChat: (chat: AiChatItem) => void;
}) {
  return (
    <SectionCard className="rounded-xl">
      <div className="hidden grid-cols-[1fr_160px_128px_48px] gap-3 border-b px-3 pb-3 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground sm:grid">
        <p>Chat / reunião</p>
        <p>Data</p>
        <p>Status</p>
        <p className="text-right">Ações</p>
      </div>
      {chats.length === 0 ? (
        <EmptyState
          className="mt-3 border-0 bg-transparent"
          title="Nenhum chat encontrado"
          description={
            selectedMeetingId === "all"
              ? "Os chats feitos nas reuniões aparecerão aqui."
              : "Esta reunião não possui chats no filtro atual."
          }
        />
      ) : null}
      <div className="space-y-1">
        {chats.map((chat) => (
          <ChatRow
            key={chat.id}
            chat={chat}
            active={chat.id === selectedChatId}
            onOpen={onOpenChat}
            onDelete={onDeleteChat}
          />
        ))}
      </div>
    </SectionCard>
  );
}

function AiChatsFilter({
  meetingOptions,
  selectedMeetingId,
  onChange,
}: {
  meetingOptions: AiChatMeetingOption[];
  selectedMeetingId: string;
  onChange: (meetingId: string) => void;
}) {
  return (
    <FilterBar
      left={
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquareText className="h-4 w-4 text-primary" />
          Histórico somente leitura das perguntas feitas para a IA
        </div>
      }
      right={
        <MeetingFilter
          selectedMeetingId={selectedMeetingId}
          meetingOptions={meetingOptions}
          onChange={onChange}
        />
      }
    />
  );
}

function useAiChatsState(initialChats: AiChatItem[]) {
  const [chats, setChats] = useState(initialChats);
  const [selectedMeetingId, setSelectedMeetingId] = useState("all");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AiChatItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const meetingOptions = useMemo(() => buildMeetingOptions(chats), [chats]);
  const filteredChats = useMemo(
    () => filterAiChatsByMeeting(chats, selectedMeetingId),
    [chats, selectedMeetingId]
  );
  const selectedChat = chats.find((chat) => chat.id === selectedChatId) ?? null;

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAiChat(deleteTarget.id);
      setChats((current) => current.filter((chat) => chat.id !== deleteTarget.id));
      if (selectedChatId === deleteTarget.id) setSelectedChatId(null);
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Erro ao excluir chat.");
    } finally {
      setDeleting(false);
    }
  }

  return {
    chats,
    deleteError,
    deleting,
    deleteTarget,
    filteredChats,
    meetingOptions,
    selectedChat,
    selectedChatId,
    selectedMeetingId,
    confirmDelete: handleConfirmDelete,
    setDeleteTarget,
    setSelectedChatId,
    setSelectedMeetingId,
  };
}

export function AiChatsClient({ initialData }: AiChatsClientProps) {
  const state = useAiChatsState(initialData.chats);
  const selectedChatMeetingTitle = state.selectedChat?.meetingTitle ?? "Reunião sem título";
  const selectedMeetingChats = state.selectedChat
    ? state.chats
        .filter((chat) => chat.meetingId === state.selectedChat?.meetingId)
        .map((chat) => ({
          id: chat.id,
          status: chat.status,
          question: chat.question,
          answer: chat.answer,
          fallbackReason: chat.fallbackReason,
          modelConfirmed: chat.modelConfirmed,
          sources: chat.sources,
          errorMessage: chat.errorMessage,
          createdAt: chat.createdAt,
          completedAt: chat.completedAt,
        }))
    : [];

  return (
    <PageShell>
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Chats IA" }]}
        title="Chats IA"
        description={`${state.chats.length} ${
          state.chats.length === 1 ? "chat arquivado" : "chats arquivados"
        }`}
      />

      <QuotaCard quota={initialData.quota} />

      <AiChatsFilter
        meetingOptions={state.meetingOptions}
        selectedMeetingId={state.selectedMeetingId}
        onChange={state.setSelectedMeetingId}
      />

      {state.deleteError ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.deleteError}
        </div>
      ) : null}

      <AiChatsListSection
        chats={state.filteredChats}
        selectedChatId={state.selectedChatId}
        selectedMeetingId={state.selectedMeetingId}
        onOpenChat={(chat) => state.setSelectedChatId(chat.id)}
        onDeleteChat={state.setDeleteTarget}
      />

      <MeetingArchivedChatsSheet
        meetingId={state.selectedChat?.meetingId ?? ""}
        open={Boolean(state.selectedChat)}
        onOpenChange={(open) => {
          if (!open) state.setSelectedChatId(null);
        }}
        meetingTitle={selectedChatMeetingTitle}
        chats={selectedMeetingChats}
        initialChatId={state.selectedChat?.id ?? null}
      />
      <DeleteChatDialog
        chat={state.deleteTarget}
        deleting={state.deleting}
        onOpenChange={(open) => {
          if (!open && !state.deleting) state.setDeleteTarget(null);
        }}
        onConfirm={() => void state.confirmDelete()}
      />
    </PageShell>
  );
}
