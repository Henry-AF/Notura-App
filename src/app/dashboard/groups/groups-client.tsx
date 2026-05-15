"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FolderPlus,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
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
  EmptyState,
  LoadingState,
  PageHeader,
  PageShell,
  SectionCard,
} from "@/components/ui/app";
import { formatRelativeTime } from "@/lib/utils";
import {
  createGroup,
  fetchGroupsPageData,
  moveMeetingToGroup,
  removeGroup,
  renameGroup,
  type GroupsPageData,
  type GroupsPageGroup,
  type GroupsPageMeeting,
} from "./groups-api";

const SELECT_PLACEHOLDER = "__placeholder__";

function GroupAvatar({ name }: { name: string }) {
  return (
    <Avatar className="h-10 w-10 rounded-lg">
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
              {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              Salvar grupo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteGroupDialog({
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
          <DialogTitle>Deletar grupo?</DialogTitle>
          <DialogDescription>
            As reunioes permanecem salvas e ficam sem grupo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
          <GroupAvatar name={group?.name ?? "Grupo"} />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {group?.name ?? "Grupo"}
            </p>
            <p className="text-xs text-muted-foreground">
              {group?.meetingsCount ?? 0} reunioes serao desagrupadas
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" disabled={isSaving} onClick={onConfirm}>
            {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Deletar
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
    <article className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-accent/40">
      <div className="min-w-0 flex-1">
        <Link
          href={`/dashboard/meetings/${meeting.id}`}
          className="truncate text-sm font-semibold text-foreground hover:text-primary"
        >
          {meeting.clientName}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {meeting.title} - {formatRelativeTime(meeting.createdAt)}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 w-8 rounded-md p-0"
        onClick={() => onRemove(meeting.id)}
        aria-label="Remover do grupo"
      >
        <X className="h-4 w-4" />
      </Button>
    </article>
  );
}

function SelectedGroupPanel({
  group,
  meetings,
  addableMeetings,
  onEdit,
  onDelete,
  onAddMeeting,
  onRemoveMeeting,
}: {
  group: GroupsPageGroup | null;
  meetings: GroupsPageMeeting[];
  addableMeetings: GroupsPageMeeting[];
  onEdit: (group: GroupsPageGroup) => void;
  onDelete: (group: GroupsPageGroup) => void;
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

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <GroupAvatar name={group.name} />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-foreground">
              {group.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {meetings.length} reunioes neste grupo
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onEdit(group)}>
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onDelete(group)}>
            <Trash2 className="h-4 w-4" />
            Deletar
          </Button>
        </div>
      </div>

      <Select
        value={SELECT_PLACEHOLDER}
        onValueChange={(meetingId) => onAddMeeting(meetingId)}
      >
        <SelectTrigger className="h-10 rounded-lg">
          <SelectValue placeholder="Adicionar reuniao" />
        </SelectTrigger>
        <SelectContent className="animate-none">
          <SelectItem value={SELECT_PLACEHOLDER} disabled>
            Adicionar reuniao
          </SelectItem>
          {addableMeetings.map((meeting) => (
            <SelectItem key={meeting.id} value={meeting.id}>
              {meeting.clientName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {meetings.length === 0 ? (
        <EmptyState
          className="min-h-[220px] border-0 bg-transparent"
          title="Grupo vazio"
          description="Adicione reunioes existentes ou escolha este grupo ao criar uma nova reuniao."
        />
      ) : (
        <div className="divide-y">
          {meetings.map((meeting) => (
            <MeetingRow
              key={meeting.id}
              meeting={meeting}
              onRemove={onRemoveMeeting}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function GroupsClient() {
  const [data, setData] = useState<GroupsPageData>({ groups: [], meetings: [] });
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<GroupsPageGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroupsPageGroup | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedGroup = useMemo(
    () => data.groups.find((group) => group.id === selectedGroupId) ?? null,
    [data.groups, selectedGroupId]
  );
  const selectedMeetings = data.meetings.filter(
    (meeting) => meeting.groupId === selectedGroupId
  );
  const addableMeetings = data.meetings.filter(
    (meeting) => meeting.groupId !== selectedGroupId
  );

  async function reload() {
    setError(null);
    const nextData = await fetchGroupsPageData();
    setData(nextData);
    setSelectedGroupId((current) => current ?? nextData.groups[0]?.id ?? null);
  }

  useEffect(() => {
    void reload()
      .catch(() => setError("Erro ao carregar grupos."))
      .finally(() => setIsLoading(false));
  }, []);

  async function saveGroup(name: string, groupId?: string) {
    setIsSaving(true);
    try {
      const group = groupId ? await renameGroup(groupId, name) : await createGroup(name);
      await reload();
      setSelectedGroupId(group.id);
      setIsCreateOpen(false);
      setEditingGroup(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar grupo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteGroup() {
    if (!deleteTarget) return;
    setIsSaving(true);
    try {
      await removeGroup(deleteTarget.id);
      setDeleteTarget(null);
      setSelectedGroupId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao deletar grupo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMoveMeeting(meetingId: string, groupId: string | null) {
    setError(null);
    await moveMeetingToGroup(meetingId, groupId);
    await reload();
  }

  if (isLoading) {
    return <LoadingState label="Carregando grupos..." />;
  }

  return (
    <PageShell>
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Grupos" }]}
        title="Grupos"
        description="Organize reunioes por cliente, projeto ou contexto."
        actions={
          <Button size="lg" className="rounded-full px-6" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-[18px] w-[18px]" />
            Novo grupo
          </Button>
        }
      />

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <SectionCard title="Seus grupos" contentClassName="p-3 pt-3">
          <GroupList
            groups={data.groups}
            selectedId={selectedGroupId}
            onSelect={setSelectedGroupId}
          />
        </SectionCard>

        <SectionCard
          title="Reunioes do grupo"
          contentClassName="p-4 pt-4 sm:p-6 sm:pt-6"
        >
          <SelectedGroupPanel
            group={selectedGroup}
            meetings={selectedMeetings}
            addableMeetings={addableMeetings}
            onEdit={setEditingGroup}
            onDelete={setDeleteTarget}
            onAddMeeting={(meetingId) => void handleMoveMeeting(meetingId, selectedGroupId)}
            onRemoveMeeting={(meetingId) => void handleMoveMeeting(meetingId, null)}
          />
        </SectionCard>
      </div>

      <GroupDialog
        open={isCreateOpen}
        title="Criar grupo"
        initialName=""
        isSaving={isSaving}
        onOpenChange={setIsCreateOpen}
        onSubmit={(name) => saveGroup(name)}
      />
      <GroupDialog
        open={Boolean(editingGroup)}
        title="Editar grupo"
        initialName={editingGroup?.name ?? ""}
        isSaving={isSaving}
        onOpenChange={(open) => setEditingGroup(open ? editingGroup : null)}
        onSubmit={(name) => saveGroup(name, editingGroup?.id)}
      />
      <DeleteGroupDialog
        group={deleteTarget}
        open={Boolean(deleteTarget)}
        isSaving={isSaving}
        onOpenChange={(open) => setDeleteTarget(open ? deleteTarget : null)}
        onConfirm={handleDeleteGroup}
      />
    </PageShell>
  );
}
