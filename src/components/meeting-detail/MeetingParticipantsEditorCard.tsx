"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Building2, Check, Loader2, Save, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/app";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MeetingParticipantDisplay } from "@/app/dashboard/meetings/[id]/meeting-types";

export interface MeetingParticipantsEditorCardProps {
  participants: MeetingParticipantDisplay[];
  entities: MeetingParticipantDisplay[];
  onSaveParticipant: (
    participantId: string,
    displayName: string,
    role: "participant" | "entity"
  ) => Promise<MeetingParticipantDisplay>;
  onError?: (message: string) => void;
}

export function MeetingParticipantsEditorCard({
  participants,
  entities,
  onSaveParticipant,
  onError,
}: MeetingParticipantsEditorCardProps) {
  const rows = useMemo(
    () => [...participants, ...entities].filter((row) => row.id),
    [entities, participants]
  );
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    buildDrafts(rows)
  );
  const [roleDrafts, setRoleDrafts] = useState<Record<string, "participant" | "entity">>(
    () => buildRoleDrafts(rows)
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(buildDrafts(rows));
    setRoleDrafts(buildRoleDrafts(rows));
  }, [rows]);

  async function saveRow(row: MeetingParticipantDisplay) {
    if (!row.id) return;
    const draft = drafts[row.id].trim();
    const updatedRole = roleDrafts[row.id] ?? row.role ?? "participant";
    if (!draft || (draft === row.name && updatedRole === row.role)) return;

    setSavingId(row.id);
    setSavedId(null);
    try {
      const updated = await onSaveParticipant(row.id, draft, updatedRole);
      setDrafts((current) => ({ ...current, [row.id as string]: updated.name }));
      setRoleDrafts((current) => ({ ...current, [row.id as string]: updated.role ?? updatedRole }));
      setSavedId(row.id);
      window.setTimeout(() => setSavedId(null), 1800);
    } catch (error) {
      setDrafts((current) => ({ ...current, [row.id as string]: row.name }));
      onError?.(
        error instanceof Error ? error.message : "Erro ao atualizar nome."
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <SectionCard
      title="Integrantes e entidades"
      description="Edite os nomes usados no resumo sem reprocessar a reunião."
      className="rounded-xl"
    >
      <div className="space-y-5">
        <ParticipantGroup
          icon={<Users className="h-4 w-4" />}
          label="Participantes"
          rows={participants}
          drafts={drafts}
          roleDrafts={roleDrafts}
          savingId={savingId}
          savedId={savedId}
          onDraftChange={(id, name) =>
            setDrafts((current) => ({ ...current, [id]: name }))
          }
          onRoleChange={(id, role) =>
            setRoleDrafts((current) => ({ ...current, [id]: role }))
          }
          onSave={saveRow}
        />
        <ParticipantGroup
          icon={<Building2 className="h-4 w-4" />}
          label="Entidades citadas"
          rows={entities}
          drafts={drafts}
          roleDrafts={roleDrafts}
          savingId={savingId}
          savedId={savedId}
          onDraftChange={(id, name) =>
            setDrafts((current) => ({ ...current, [id]: name }))
          }
          onRoleChange={(id, role) =>
            setRoleDrafts((current) => ({ ...current, [id]: role }))
          }
          onSave={saveRow}
        />
      </div>
    </SectionCard>
  );
}

function ParticipantGroup({
  icon,
  label,
  rows,
  drafts,
  roleDrafts,
  savingId,
  savedId,
  onDraftChange,
  onRoleChange,
  onSave,
}: {
  icon: React.ReactNode;
  label: string;
  rows: MeetingParticipantDisplay[];
  drafts: Record<string, string>;
  roleDrafts: Record<string, "participant" | "entity">;
  savingId: string | null;
  savedId: string | null;
  onDraftChange: (id: string, name: string) => void;
  onRoleChange: (id: string, role: "participant" | "entity") => void;
  onSave: (row: MeetingParticipantDisplay) => Promise<void>;
}) {
  const editableRows = rows.filter((row) => row.id);
  if (editableRows.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="space-y-2">
        {editableRows.map((row) => (
          <ParticipantRow
            key={row.id}
            row={row}
            draft={drafts[row.id as string] ?? row.name}
            roleDraft={roleDrafts[row.id as string] ?? row.role ?? "participant"}
            isSaving={savingId === row.id}
            isSaved={savedId === row.id}
            onDraftChange={onDraftChange}
            onRoleChange={onRoleChange}
            onSave={onSave}
          />
        ))}
      </div>
    </div>
  );
}

function ParticipantRow({
  row,
  draft,
  roleDraft,
  isSaving,
  isSaved,
  onDraftChange,
  onRoleChange,
  onSave,
}: {
  row: MeetingParticipantDisplay;
  draft: string;
  roleDraft: "participant" | "entity";
  isSaving: boolean;
  isSaved: boolean;
  onDraftChange: (id: string, name: string) => void;
  onRoleChange: (id: string, role: "participant" | "entity") => void;
  onSave: (row: MeetingParticipantDisplay) => Promise<void>;
}) {
  if (!row.id) return null;
  const hasChanges = draft.trim() !== row.name || roleDraft !== row.role;

  return (
    <div className="rounded-lg border bg-background/70 p-2">
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(event) => onDraftChange(row.id as string, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void onSave(row);
            }
          }}
          aria-label={`Editar nome de ${row.name}`}
          className="h-9"
        />
        <Select
          value={roleDraft}
          onValueChange={(value) =>
            onRoleChange(row.id as string, value as "participant" | "entity")
          }
        >
          <SelectTrigger className="h-9 w-[132px] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="participant">Integrante</SelectItem>
            <SelectItem value="entity">Entidade</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant={hasChanges ? "default" : "outline"}
          disabled={isSaving || !hasChanges}
          onClick={() => { void onSave(row); }}
          aria-label={`Salvar nome de ${row.name}`}
          className="h-9 w-9 shrink-0"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isSaved ? (
            <Check className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
        </Button>
      </div>
      {row.originalName && row.originalName !== row.name ? (
        <p className="mt-1 px-1 text-[11px] text-muted-foreground">
          Original: {row.originalName}
        </p>
      ) : null}
    </div>
  );
}

function buildDrafts(rows: MeetingParticipantDisplay[]) {
  return Object.fromEntries(
    rows
      .filter((row): row is MeetingParticipantDisplay & { id: string } =>
        Boolean(row.id)
      )
      .map((row) => [row.id, row.name])
  );
}

function buildRoleDrafts(rows: MeetingParticipantDisplay[]) {
  return Object.fromEntries(
    rows
      .filter((row): row is MeetingParticipantDisplay & { id: string } =>
        Boolean(row.id)
      )
      .map((row) => [row.id, row.role ?? "participant"])
  );
}
