"use client";

import React, { useEffect, useMemo, useReducer } from "react";
import {
  Building2,
  Check,
  ChevronDown,
  GitMerge,
  Loader2,
  Pencil,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/app";
import type { MeetingParticipantDisplay } from "@/app/dashboard/meetings/[id]/meeting-types";

type ParticipantRole = "participant" | "entity";
type ParticipantGroupId = "participants" | "entities";

type ParticipantsEditorState = {
  drafts: Record<string, string>;
  roleDrafts: Record<string, ParticipantRole>;
  editingId: string | null;
  draftName: string;
  mergePanelId: string | null;
  collapsedGroups: Record<ParticipantGroupId, boolean>;
  savingId: string | null;
  mergingId: string | null;
  savedId: string | null;
};

type ParticipantsEditorAction =
  | { type: "rowsSynced"; rows: MeetingParticipantDisplay[] }
  | { type: "editingStarted"; id: string; draftName: string }
  | { type: "editingCanceled" }
  | { type: "draftNameChanged"; value: string }
  | { type: "savingStarted"; id: string }
  | { type: "rowSaved"; id: string; name: string; role: ParticipantRole }
  | { type: "saveReverted"; id: string; name: string; role: ParticipantRole }
  | { type: "saveFinished" }
  | { type: "roleDraftChanged"; id: string; role: ParticipantRole }
  | { type: "mergingStarted"; id: string }
  | { type: "mergingFinished" }
  | { type: "savedCleared" }
  | { type: "mergePanelToggled"; id: string }
  | { type: "collapsedGroupToggled"; groupId: ParticipantGroupId };

function createParticipantsEditorState(
  rows: MeetingParticipantDisplay[]
): ParticipantsEditorState {
  return {
    drafts: buildDrafts(rows),
    roleDrafts: buildRoleDrafts(rows),
    editingId: null,
    draftName: "",
    mergePanelId: null,
    collapsedGroups: {
      participants: false,
      entities: false,
    },
    savingId: null,
    mergingId: null,
    savedId: null,
  };
}

function participantsEditorReducer(
  state: ParticipantsEditorState,
  action: ParticipantsEditorAction
): ParticipantsEditorState {
  switch (action.type) {
    case "rowsSynced":
      return {
        ...state,
        drafts: buildDrafts(action.rows),
        roleDrafts: buildRoleDrafts(action.rows),
      };
    case "editingStarted":
      return {
        ...state,
        mergePanelId: null,
        editingId: action.id,
        draftName: action.draftName,
      };
    case "editingCanceled":
      return { ...state, editingId: null, draftName: "" };
    case "draftNameChanged":
      return { ...state, draftName: action.value };
    case "savingStarted":
      return { ...state, savingId: action.id, savedId: null };
    case "rowSaved":
      return {
        ...state,
        drafts: { ...state.drafts, [action.id]: action.name },
        roleDrafts: { ...state.roleDrafts, [action.id]: action.role },
        savedId: action.id,
      };
    case "saveReverted":
      return {
        ...state,
        drafts: { ...state.drafts, [action.id]: action.name },
        roleDrafts: { ...state.roleDrafts, [action.id]: action.role },
      };
    case "saveFinished":
      return { ...state, editingId: null, draftName: "", savingId: null };
    case "roleDraftChanged":
      return {
        ...state,
        mergePanelId: null,
        roleDrafts: { ...state.roleDrafts, [action.id]: action.role },
      };
    case "mergingStarted":
      return { ...state, mergingId: action.id, savedId: null };
    case "mergingFinished":
      return { ...state, mergingId: null };
    case "savedCleared":
      return { ...state, savedId: null };
    case "mergePanelToggled":
      return {
        ...state,
        mergePanelId: state.mergePanelId === action.id ? null : action.id,
      };
    case "collapsedGroupToggled":
      return {
        ...state,
        collapsedGroups: {
          ...state.collapsedGroups,
          [action.groupId]: !state.collapsedGroups[action.groupId],
        },
      };
  }
}

export interface MeetingParticipantsEditorCardProps {
  participants: MeetingParticipantDisplay[];
  entities: MeetingParticipantDisplay[];
  onSaveParticipant: (
    participantId: string,
    displayName: string,
    role: ParticipantRole
  ) => Promise<MeetingParticipantDisplay>;
  onMergeParticipant: (
    participantId: string,
    mergeIntoParticipantId: string
  ) => Promise<MeetingParticipantDisplay>;
  onError?: (message: string) => void;
}

export function MeetingParticipantsEditorCard({
  participants,
  entities,
  onSaveParticipant,
  onMergeParticipant,
  onError,
}: MeetingParticipantsEditorCardProps) {
  const rows = useMemo(
    () => [...participants, ...entities].filter((row) => row.id),
    [entities, participants]
  );
  const [state, dispatch] = useReducer(
    participantsEditorReducer,
    rows,
    createParticipantsEditorState
  );
  const {
    drafts,
    roleDrafts,
    editingId,
    draftName,
    mergePanelId,
    collapsedGroups,
    savingId,
    mergingId,
    savedId,
  } = state;

  useEffect(() => {
    dispatch({ type: "rowsSynced", rows });
  }, [rows]);

  function beginEditing(row: MeetingParticipantDisplay) {
    if (!row.id) return;
    dispatch({
      type: "editingStarted",
      id: row.id,
      draftName: drafts[row.id] ?? row.name,
    });
  }

  function cancelEditing() {
    dispatch({ type: "editingCanceled" });
  }

  async function persistRow(
    row: MeetingParticipantDisplay,
    displayName: string,
    role: ParticipantRole
  ) {
    if (!row.id) return;
    const nextName = displayName.trim();
    if (!nextName) {
      cancelEditing();
      return;
    }
    if (nextName === row.name && role === row.role) {
      cancelEditing();
      return;
    }

    dispatch({ type: "savingStarted", id: row.id });
    try {
      const updated = await onSaveParticipant(row.id, nextName, role);
      dispatch({
        type: "rowSaved",
        id: row.id,
        name: updated.name,
        role: updated.role ?? role,
      });
      window.setTimeout(() => dispatch({ type: "savedCleared" }), 1800);
    } catch (error) {
      dispatch({
        type: "saveReverted",
        id: row.id,
        name: row.name,
        role: row.role ?? "participant",
      });
      onError?.(
        error instanceof Error ? error.message : "Erro ao atualizar nome."
      );
    } finally {
      dispatch({ type: "saveFinished" });
    }
  }

  async function finishEditing(row: MeetingParticipantDisplay) {
    await persistRow(
      row,
      draftName,
      roleDrafts[row.id as string] ?? row.role ?? "participant"
    );
  }

  async function toggleRole(row: MeetingParticipantDisplay) {
    if (!row.id) return;
    const currentRole = roleDrafts[row.id] ?? row.role ?? "participant";
    const nextRole = currentRole === "participant" ? "entity" : "participant";
    dispatch({ type: "roleDraftChanged", id: row.id, role: nextRole });
    await persistRow(row, drafts[row.id] ?? row.name, nextRole);
  }

  async function mergeRow(
    row: MeetingParticipantDisplay,
    target: MeetingParticipantDisplay
  ) {
    if (!row.id || !target.id) return;
    if (!window.confirm(`Mesclar "${row.name}" com "${target.name}"?`)) return;

    dispatch({ type: "mergingStarted", id: row.id });
    try {
      await onMergeParticipant(row.id, target.id);
    } catch (error) {
      onError?.(
        error instanceof Error ? error.message : "Erro ao mesclar participantes."
      );
    } finally {
      dispatch({ type: "mergingFinished" });
    }
  }

  function toggleCollapsedGroup(groupId: ParticipantGroupId) {
    dispatch({ type: "collapsedGroupToggled", groupId });
  }

  return (
    <SectionCard
      title="Integrantes e entidades"
      description="Edite os nomes usados no resumo sem reprocessar a reunião."
      className="rounded-xl"
    >
      <div className="space-y-5">
        <ParticipantGroup
          groupId="participants"
          icon={<Users className="size-4" />}
          label="Participantes"
          isCollapsed={collapsedGroups.participants}
          rows={participants}
          drafts={drafts}
          roleDrafts={roleDrafts}
          editingId={editingId}
          draftName={draftName}
          savingId={savingId}
          mergingId={mergingId}
          savedId={savedId}
          mergePanelId={mergePanelId}
          availableMergeOptions={participants}
          isParticipantGroup
          onBeginEditing={beginEditing}
          onDraftNameChange={(value) =>
            dispatch({ type: "draftNameChanged", value })
          }
          onCancelEditing={cancelEditing}
          onFinishEditing={finishEditing}
          onToggleRole={toggleRole}
          onToggleMergePanel={(id) =>
            dispatch({ type: "mergePanelToggled", id })
          }
          onToggleCollapsed={toggleCollapsedGroup}
          onMerge={mergeRow}
        />
        <ParticipantGroup
          groupId="entities"
          icon={<Building2 className="size-4" />}
          label="Entidades citadas"
          isCollapsed={collapsedGroups.entities}
          rows={entities}
          drafts={drafts}
          roleDrafts={roleDrafts}
          editingId={editingId}
          draftName={draftName}
          savingId={savingId}
          mergingId={mergingId}
          savedId={savedId}
          mergePanelId={mergePanelId}
          availableMergeOptions={[]}
          onBeginEditing={beginEditing}
          onDraftNameChange={(value) =>
            dispatch({ type: "draftNameChanged", value })
          }
          onCancelEditing={cancelEditing}
          onFinishEditing={finishEditing}
          onToggleRole={toggleRole}
          onToggleMergePanel={(id) =>
            dispatch({ type: "mergePanelToggled", id })
          }
          onToggleCollapsed={toggleCollapsedGroup}
          onMerge={mergeRow}
        />
      </div>
    </SectionCard>
  );
}

function ParticipantGroup({
  groupId,
  icon,
  label,
  isCollapsed,
  rows,
  drafts,
  roleDrafts,
  editingId,
  draftName,
  savingId,
  mergingId,
  savedId,
  mergePanelId,
  availableMergeOptions,
  isParticipantGroup = false,
  onBeginEditing,
  onDraftNameChange,
  onCancelEditing,
  onFinishEditing,
  onToggleRole,
  onToggleMergePanel,
  onToggleCollapsed,
  onMerge,
}: {
  groupId: ParticipantGroupId;
  icon: React.ReactNode;
  label: string;
  isCollapsed: boolean;
  rows: MeetingParticipantDisplay[];
  drafts: Record<string, string>;
  roleDrafts: Record<string, ParticipantRole>;
  editingId: string | null;
  draftName: string;
  savingId: string | null;
  mergingId: string | null;
  savedId: string | null;
  mergePanelId: string | null;
  availableMergeOptions: MeetingParticipantDisplay[];
  isParticipantGroup?: boolean;
  onBeginEditing: (row: MeetingParticipantDisplay) => void;
  onDraftNameChange: (name: string) => void;
  onCancelEditing: () => void;
  onFinishEditing: (row: MeetingParticipantDisplay) => Promise<void>;
  onToggleRole: (row: MeetingParticipantDisplay) => Promise<void>;
  onToggleMergePanel: (id: string) => void;
  onToggleCollapsed: (groupId: ParticipantGroupId) => void;
  onMerge: (
    row: MeetingParticipantDisplay,
    target: MeetingParticipantDisplay
  ) => Promise<void>;
}) {
  const editableRows = rows.filter((row) => row.id);
  if (editableRows.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-expanded={!isCollapsed}
        onClick={() => onToggleCollapsed(groupId)}
        className="flex w-full items-center justify-between gap-2 text-xs font-semibold uppercase text-muted-foreground"
      >
        <span className="flex items-center gap-2">
          {icon}
          {label}
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
            {editableRows.length}
          </span>
        </span>
        <ChevronDown
          className={`size-4 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
        />
      </button>
      {!isCollapsed ? (
        <div className="space-y-2">
          {editableRows.map((row) => (
            <ParticipantRow
              key={row.id}
              row={row}
              displayName={drafts[row.id as string] ?? row.name}
              role={roleDrafts[row.id as string] ?? row.role ?? "participant"}
              isEditing={editingId === row.id}
              draftName={draftName}
              isSaving={savingId === row.id}
              isMerging={mergingId === row.id}
              isSaved={savedId === row.id}
              showMergePanel={mergePanelId === row.id}
              mergeOptions={availableMergeOptions.filter(
                (option) => option.id && option.id !== row.id
              )}
              canMerge={isParticipantGroup}
              onBeginEditing={onBeginEditing}
              onDraftNameChange={onDraftNameChange}
              onCancelEditing={onCancelEditing}
              onFinishEditing={onFinishEditing}
              onToggleRole={onToggleRole}
              onToggleMergePanel={onToggleMergePanel}
              onMerge={onMerge}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ParticipantRow({
  row,
  displayName,
  role,
  isEditing,
  draftName,
  isSaving,
  isMerging,
  isSaved,
  showMergePanel,
  mergeOptions,
  canMerge,
  onBeginEditing,
  onDraftNameChange,
  onCancelEditing,
  onFinishEditing,
  onToggleRole,
  onToggleMergePanel,
  onMerge,
}: {
  row: MeetingParticipantDisplay;
  displayName: string;
  role: ParticipantRole;
  isEditing: boolean;
  draftName: string;
  isSaving: boolean;
  isMerging: boolean;
  isSaved: boolean;
  showMergePanel: boolean;
  mergeOptions: MeetingParticipantDisplay[];
  canMerge: boolean;
  onBeginEditing: (row: MeetingParticipantDisplay) => void;
  onDraftNameChange: (name: string) => void;
  onCancelEditing: () => void;
  onFinishEditing: (row: MeetingParticipantDisplay) => Promise<void>;
  onToggleRole: (row: MeetingParticipantDisplay) => Promise<void>;
  onToggleMergePanel: (id: string) => void;
  onMerge: (
    row: MeetingParticipantDisplay,
    target: MeetingParticipantDisplay
  ) => Promise<void>;
}) {
  if (!row.id) return null;

  return (
    <div className="group rounded-lg border bg-background/70 p-3 transition-colors hover:bg-muted/30">
      <div className="flex items-center gap-3">
        <Avatar className="size-9 border border-border">
          <AvatarFallback name={displayName} className="text-[11px] font-semibold" />
        </Avatar>
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <Input
              value={draftName}
              autoFocus
              onChange={(event) => onDraftNameChange(event.target.value)}
              onBlur={() => { void onFinishEditing(row); }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void onFinishEditing(row);
                }
                if (event.key === "Escape") {
                  onCancelEditing();
                }
              }}
              aria-label={`Editar nome de ${row.name}`}
              className="h-8"
            />
          ) : (
            <button
              type="button"
              onClick={() => onBeginEditing(row)}
             className="block max-w-full truncate text-left text-sm font-semibold text-foreground hover:text-primary"
            >
              {displayName}
              <Pencil
                className="ml-1.5 inline size-3 align-[-1px] text-muted-foreground"
                aria-hidden="true"
              />
            </button>
          )}
          {row.originalName && row.originalName !== displayName ? (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              Original: {row.originalName}
            </p>
          ) : null}
        </div>
        {canMerge && mergeOptions.length > 0 ? (
          <MergeButton
            row={row}
            isMerging={isMerging}
            onToggleMergePanel={onToggleMergePanel}
          />
        ) : null}
        <RolePill role={role} disabled={isSaving} onClick={() => { void onToggleRole(row); }} />
        {isSaving ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
        {isSaved && !isSaving ? <Check className="size-4 text-emerald-500" /> : null}
      </div>
      {showMergePanel && canMerge ? (
        <MergePanel
          row={row}
          mergeOptions={mergeOptions}
          onMerge={onMerge}
          isMerging={isMerging}
        />
      ) : null}
    </div>
  );
}

function MergeButton({
  row,
  isMerging,
  onToggleMergePanel,
}: {
  row: MeetingParticipantDisplay;
  isMerging: boolean;
  onToggleMergePanel: (id: string) => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={isMerging}
      onClick={() => onToggleMergePanel(row.id as string)}
      aria-label={`Abrir mesclagem de ${row.name}`}
      className="size-8 shrink-0 border border-border/70 bg-muted/40 text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
    >
      {isMerging ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <GitMerge className="size-4" />
      )}
    </Button>
  );
}

function RolePill({
  role,
  disabled,
  onClick,
}: {
  role: ParticipantRole;
  disabled: boolean;
  onClick: () => void;
}) {
  const label = role === "participant" ? "Integrante" : "Entidade";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="shrink-0 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
    >
      {label}
    </button>
  );
}

function MergePanel({
  row,
  mergeOptions,
  isMerging,
  onMerge,
}: {
  row: MeetingParticipantDisplay;
  mergeOptions: MeetingParticipantDisplay[];
  isMerging: boolean;
  onMerge: (
    row: MeetingParticipantDisplay,
    target: MeetingParticipantDisplay
  ) => Promise<void>;
}) {
  return (
    <div className="mt-3 rounded-lg border border-dashed bg-muted/30 p-2">
      <div className="flex flex-wrap gap-1.5">
        {mergeOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={isMerging}
            onClick={() => { void onMerge(row, option); }}
            className="rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-60"
          >
            {option.name}
          </button>
        ))}
      </div>
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
