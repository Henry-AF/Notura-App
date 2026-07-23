"use client";

import React, { useEffect, useMemo, useReducer, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  Pencil,
  Plus,
  RefreshCw,
  X,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DashboardListSection,
  EmptyState,
  PageHeader,
  PageShell,
  SectionCard,
  StatusBadge,
} from "@/components/ui/app";
import { formatRelativeTime } from "@/lib/utils";
import {
  archiveGroup,
  createGroup,
  fetchGroupsPageData,
  moveMeetingToGroup,
  renameGroup,
  unarchiveGroup,
  type GroupsPageData,
  type GroupsPageGroup,
  type GroupsPageMeeting,
} from "./groups-api";

const SELECT_PLACEHOLDER = "__placeholder__";
type GroupsViewMode = "active" | "archived";

function GroupAvatar({ name }: { name: string }) {
  return (
    <Avatar className="size-10 rounded-lg">
      <AvatarFallback name={name} className="rounded-lg text-xs font-semibold" />
    </Avatar>
  );
}

function GroupDialog({
  open,
  title,
  initialName,
  isSaving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initialName: string;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);

  useEffect(() => setName(initialName), [initialName, open]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(name);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Use um nome curto para encontrar reunioes relacionadas rapidamente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            autoFocus
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex: Cliente Acme"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <RefreshCw className="size-4 animate-spin" /> : null}
              Salvar grupo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveGroupDialog({
  group,
  open,
  isSaving,
  onOpenChange,
  onConfirm,
}: {
  group: GroupsPageGroup | null;
  open: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Arquivar grupo?</DialogTitle>
          <DialogDescription>
            As reunioes continuam vinculadas. Voce pode desarquivar o grupo quando quiser.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
          <GroupAvatar name={group?.name ?? "Grupo"} />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {group?.name ?? "Grupo"}
            </p>
            <p className="text-xs text-muted-foreground">
              {group?.meetingsCount ?? 0} reunioes permanecem vinculadas
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={isSaving} onClick={onConfirm}>
            {isSaving ? <RefreshCw className="size-4 animate-spin" /> : <Archive className="size-4" />}
            Arquivar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GroupList({
  groups,
  selectedId,
  onSelect,
}: {
  groups: GroupsPageGroup[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (groups.length === 0) {
    return (
      <EmptyState
        className="min-h-[240px] border-0 bg-transparent"
        title="Nenhum grupo criado"
        description="Crie grupos para organizar reunioes por cliente, projeto ou area."
      />
    );
  }

  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <button
          key={group.id}
          type="button"
          onClick={() => onSelect(group.id)}
          className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors ${
            selectedId === group.id
              ? "bg-primary/10 text-primary"
              : "hover:bg-accent/50"
          }`}
        >
          <GroupAvatar name={group.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{group.name}</p>
            <p className="text-xs text-muted-foreground">
              {group.meetingsCount} reunioes
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

function MeetingRow({
  meeting,
  onRemove,
}: {
  meeting: GroupsPageMeeting;
  onRemove: (meetingId: string) => void;
}) {
  return (
    <article className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent/40 sm:grid sm:grid-cols-[1fr_120px_120px_48px] sm:gap-2 sm:px-3 sm:py-3">
      <Avatar className="size-9 shrink-0 sm:hidden">
        <AvatarFallback name={meeting.title} className="text-[11px] font-semibold" />
      </Avatar>

      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-3">
        <Avatar className="hidden size-8 shrink-0 sm:flex">
          <AvatarFallback name={meeting.title} className="text-[11px] font-semibold" />
        </Avatar>

        <div className="min-w-0 flex-1">
          <Link
            href={`/dashboard/meetings/${meeting.id}`}
            className="block truncate text-sm font-semibold text-foreground hover:text-primary"
          >
            {meeting.title}
          </Link>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:hidden">
          <span className="text-[11px] text-muted-foreground">
            {formatRelativeTime(meeting.createdAt)}
          </span>
          <StatusBadge status={meeting.status} />
        </div>
      </div>

      <p className="hidden text-xs text-muted-foreground sm:block">
        {formatRelativeTime(meeting.createdAt)}
      </p>

      <div className="hidden sm:block">
        <StatusBadge status={meeting.status} />
      </div>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="size-8 rounded-md p-0 sm:justify-self-end"
        onClick={() => onRemove(meeting.id)}
        aria-label="Remover do grupo"
      >
        <X className="size-4" />
      </Button>
    </article>
  );
}

function SelectedGroupPanel({
  group,
  meetings,
  addableMeetings,
  onEdit,
  onArchive,
  onUnarchive,
  onAddMeeting,
  onRemoveMeeting,
}: {
  group: GroupsPageGroup | null;
  meetings: GroupsPageMeeting[];
  addableMeetings: GroupsPageMeeting[];
  onEdit: (group: GroupsPageGroup) => void;
  onArchive: (group: GroupsPageGroup) => void;
  onUnarchive: (group: GroupsPageGroup) => void;
  onAddMeeting: (meetingId: string) => void;
  onRemoveMeeting: (meetingId: string) => void;
}) {
  if (!group) {
    return (
      <EmptyState
        className="min-h-[360px] border-0 bg-transparent"
        title="Selecione um grupo"
        description="Escolha um grupo para ver e controlar as reunioes nele."
      />
    );
  }

  const isArchived = Boolean(group.archivedAt);

  return (
    <DashboardListSection
      context={
        <div className="flex min-w-0 items-center gap-3">
          <GroupAvatar name={group.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Grupo: {group.name}
            </p>
            <p className="text-sm text-muted-foreground">
              {meetings.length} reunioes neste grupo
            </p>
          </div>
        </div>
      }
      actions={
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {isArchived ? (
            <Button type="button" variant="outline" size="sm" onClick={() => onUnarchive(group)}>
              <ArchiveRestore className="size-4" />
              <span className="hidden sm:inline">Desarquivar</span>
            </Button>
          ) : (
            <>
              <Select
                value={SELECT_PLACEHOLDER}
                onValueChange={(meetingId) => onAddMeeting(meetingId)}
              >
                <SelectTrigger className="h-10 w-full min-w-0 rounded-lg sm:min-w-[220px]" disabled={addableMeetings.length === 0}>
                  <SelectValue placeholder="Adicionar reuniao" />
                </SelectTrigger>
                <SelectContent className="animate-none">
                  <SelectItem value={SELECT_PLACEHOLDER} disabled>
                    Adicionar reuniao
                  </SelectItem>
                  {addableMeetings.map((meeting) => (
                    <SelectItem key={meeting.id} value={meeting.id}>
                      {meeting.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="sm" onClick={() => onEdit(group)}>
                <Pencil className="size-4" />
                <span className="hidden sm:inline">Editar</span>
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => onArchive(group)}>
                <Archive className="size-4" />
                <span className="hidden sm:inline">Arquivar</span>
              </Button>
            </>
          )}
        </div>
      }
      header={
        <div className="grid grid-cols-[1fr_120px_120px_48px] gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          <p>Título</p>
          <p>Data</p>
          <p>Status</p>
          <p className="text-right">Ações</p>
        </div>
      }
      emptyState={
        meetings.length === 0 ? (
          <EmptyState
            className="min-h-[220px] border-0 bg-transparent"
            title="Grupo vazio"
            description="Adicione reunioes existentes ou escolha este grupo ao criar uma nova reuniao."
          />
        ) : undefined
      }
      contentClassName="px-3 pb-3 pt-3 sm:px-6 sm:pb-6 sm:pt-6"
      className="min-w-0 overflow-hidden"
    >
      {meetings.map((meeting) => (
        <MeetingRow
          key={meeting.id}
          meeting={meeting}
          onRemove={onRemoveMeeting}
        />
      ))}
    </DashboardListSection>
  );
}

function filterGroupsByViewMode(
  groups: GroupsPageGroup[],
  viewMode: GroupsViewMode
): GroupsPageGroup[] {
  return groups.filter((group) =>
    viewMode === "active" ? !group.archivedAt : Boolean(group.archivedAt)
  );
}

export function GroupsClient({ initialData }: { initialData: GroupsPageData }) {
  type GroupsClientState = {
    data: GroupsPageData;
    viewMode: GroupsViewMode;
    selectedGroupId: string | null;
    editingGroup: GroupsPageGroup | null;
    archiveTarget: GroupsPageGroup | null;
    isCreateOpen: boolean;
    isSaving: boolean;
    error: string | null;
  };
  type GroupsClientAction =
    | { type: "patched"; value: Partial<GroupsClientState> }
    | { type: "reloaded"; data: GroupsPageData }
    | { type: "groupSaved"; groupId: string }
    | { type: "archiveActionStarted" }
    | { type: "viewModeChanged"; viewMode: GroupsViewMode };
  const [state, dispatch] = useReducer(
    (current: GroupsClientState, action: GroupsClientAction): GroupsClientState => {
      switch (action.type) {
        case "patched":
          return { ...current, ...action.value };
        case "reloaded": {
          const visible = filterGroupsByViewMode(action.data.groups, current.viewMode);
          return {
            ...current,
            data: action.data,
            selectedGroupId: current.selectedGroupId ?? visible[0]?.id ?? null,
          };
        }
        case "groupSaved":
          return {
            ...current,
            selectedGroupId: action.groupId,
            isCreateOpen: false,
            editingGroup: null,
          };
        case "archiveActionStarted":
          return { ...current, archiveTarget: null, selectedGroupId: null };
        case "viewModeChanged": {
          const visible = filterGroupsByViewMode(current.data.groups, action.viewMode);
          return {
            ...current,
            viewMode: action.viewMode,
            selectedGroupId: visible[0]?.id ?? null,
          };
        }
      }
    },
    {
      data: initialData,
      viewMode: "active",
      selectedGroupId: filterGroupsByViewMode(initialData.groups, "active")[0]?.id ?? null,
      editingGroup: null,
      archiveTarget: null,
      isCreateOpen: false,
      isSaving: false,
      error: null,
    }
  );
  const {
    data,
    viewMode,
    selectedGroupId,
    editingGroup,
    archiveTarget,
    isCreateOpen,
    isSaving,
    error,
  } = state;

  const visibleGroups = useMemo(
    () => filterGroupsByViewMode(data.groups, viewMode),
    [data.groups, viewMode]
  );
  const selectedGroup = useMemo(
    () => visibleGroups.find((group) => group.id === selectedGroupId) ?? null,
    [visibleGroups, selectedGroupId]
  );
  const selectedMeetings = data.meetings.filter(
    (meeting) => meeting.groupId === selectedGroupId
  );
  const addableMeetings = data.meetings.filter(
    (meeting) => meeting.groupId !== selectedGroupId
  );

  async function reload() {
    dispatch({ type: "patched", value: { error: null } });
    const nextData = await fetchGroupsPageData(true);
    dispatch({ type: "reloaded", data: nextData });
  }

  async function saveGroup(name: string, groupId?: string) {
    dispatch({ type: "patched", value: { isSaving: true } });
    try {
      const group = groupId ? await renameGroup(groupId, name) : await createGroup(name);
      await reload();
      dispatch({ type: "groupSaved", groupId: group.id });
    } catch (err) {
      dispatch({
        type: "patched",
        value: { error: err instanceof Error ? err.message : "Erro ao salvar grupo." },
      });
    } finally {
      dispatch({ type: "patched", value: { isSaving: false } });
    }
  }

  async function handleArchiveGroup() {
    if (!archiveTarget) return;
    dispatch({ type: "patched", value: { isSaving: true } });
    try {
      await archiveGroup(archiveTarget.id);
      dispatch({ type: "archiveActionStarted" });
      await reload();
    } catch (err) {
      dispatch({
        type: "patched",
        value: { error: err instanceof Error ? err.message : "Erro ao arquivar grupo." },
      });
    } finally {
      dispatch({ type: "patched", value: { isSaving: false } });
    }
  }

  async function handleUnarchiveGroup(group: GroupsPageGroup) {
    dispatch({ type: "patched", value: { isSaving: true, error: null } });
    try {
      await unarchiveGroup(group.id);
      dispatch({ type: "archiveActionStarted" });
      await reload();
    } catch (err) {
      dispatch({
        type: "patched",
        value: { error: err instanceof Error ? err.message : "Erro ao desarquivar grupo." },
      });
    } finally {
      dispatch({ type: "patched", value: { isSaving: false } });
    }
  }

  async function handleMoveMeeting(meetingId: string, groupId: string | null) {
    dispatch({ type: "patched", value: { error: null } });
    await moveMeetingToGroup(meetingId, groupId);
    await reload();
  }

  return (
    <PageShell>
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Grupos" }]}
        title="Grupos"
        description="Organize reunioes por cliente, projeto ou contexto."
        actions={
          <Button
            size="lg"
            className="rounded-full px-6"
            onClick={() => dispatch({ type: "patched", value: { isCreateOpen: true } })}
          >
            <Plus className="size-[18px]" />
            Novo grupo
          </Button>
        }
      />

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <SectionCard
          title="Seus grupos"
          className="min-w-0"
          contentClassName="p-3 pt-3"
          actions={
            <div className="flex items-center gap-1 rounded-full bg-muted p-1">
              <Button
                type="button"
                size="sm"
                variant={viewMode === "active" ? "default" : "ghost"}
                className="h-7 rounded-full px-3 text-xs"
                onClick={() => dispatch({ type: "viewModeChanged", viewMode: "active" })}
              >
                Ativos
              </Button>
              <Button
                type="button"
                size="sm"
                variant={viewMode === "archived" ? "default" : "ghost"}
                className="h-7 rounded-full px-3 text-xs"
                onClick={() => dispatch({ type: "viewModeChanged", viewMode: "archived" })}
              >
                Arquivados
              </Button>
            </div>
          }
        >
          <GroupList
            groups={visibleGroups}
            selectedId={selectedGroupId}
            onSelect={(selectedGroupId) =>
              dispatch({ type: "patched", value: { selectedGroupId } })
            }
          />
        </SectionCard>

        <SelectedGroupPanel
          group={selectedGroup}
          meetings={selectedMeetings}
          addableMeetings={addableMeetings}
          onEdit={(editingGroup) =>
            dispatch({ type: "patched", value: { editingGroup } })
          }
          onArchive={(archiveTarget) =>
            dispatch({ type: "patched", value: { archiveTarget } })
          }
          onUnarchive={(group) => void handleUnarchiveGroup(group)}
          onAddMeeting={(meetingId) => void handleMoveMeeting(meetingId, selectedGroupId)}
          onRemoveMeeting={(meetingId) => void handleMoveMeeting(meetingId, null)}
        />
      </div>

      <GroupDialog
        open={isCreateOpen}
        title="Criar grupo"
        initialName=""
        isSaving={isSaving}
        onOpenChange={(isCreateOpen) =>
          dispatch({ type: "patched", value: { isCreateOpen } })
        }
        onSubmit={(name) => saveGroup(name)}
      />
      <GroupDialog
        open={Boolean(editingGroup)}
        title="Editar grupo"
        initialName={editingGroup?.name ?? ""}
        isSaving={isSaving}
        onOpenChange={(open) =>
          dispatch({
            type: "patched",
            value: { editingGroup: open ? editingGroup : null },
          })
        }
        onSubmit={(name) => saveGroup(name, editingGroup?.id)}
      />
      <ArchiveGroupDialog
        group={archiveTarget}
        open={Boolean(archiveTarget)}
        isSaving={isSaving}
        onOpenChange={(open) =>
          dispatch({
            type: "patched",
            value: { archiveTarget: open ? archiveTarget : null },
          })
        }
        onConfirm={handleArchiveGroup}
      />
    </PageShell>
  );
}
