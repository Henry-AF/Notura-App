"use client";

import { useRouter } from "next/navigation";
import React, { useMemo, useReducer } from "react";
import { useToast } from "@/components/upload/Toast";
import { PageHeader, PageShell, SectionCard } from "@/components/ui/app";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignMeetingToGroup } from "@/lib/meeting-groups-client";
import { validateMeetingDate } from "@/lib/meetings/meeting-date";
import type { MeetingEditData } from "./meeting-edit-types";
import { updateMeetingEditableFields } from "./meeting-edit-client-api";

export interface MeetingEditClientProps {
  id: string;
  initialMeeting: MeetingEditData | null;
}

const NO_GROUP_VALUE = "__none__";

type MeetingEditState = {
  title: string;
  meetingDate: string;
  groupId: string | null;
  selectedDate: Date | undefined;
  saving: boolean;
};

type MeetingEditAction =
  | { type: "titleChanged"; value: string }
  | { type: "groupChanged"; value: string | null }
  | { type: "dateChanged"; value: Date | undefined }
  | { type: "savingChanged"; value: boolean };

function meetingEditReducer(
  state: MeetingEditState,
  action: MeetingEditAction
): MeetingEditState {
  switch (action.type) {
    case "titleChanged":
      return { ...state, title: action.value };
    case "groupChanged":
      return { ...state, groupId: action.value };
    case "dateChanged":
      return {
        ...state,
        selectedDate: action.value,
        meetingDate: action.value ? formatDateToYmd(action.value) : "",
      };
    case "savingChanged":
      return { ...state, saving: action.value };
  }
}

function parseYmdDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;

  return new Date(year, month - 1, day);
}

function formatDateToYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function MeetingEditClient({ id, initialMeeting }: MeetingEditClientProps) {
  const router = useRouter();
  const { show } = useToast();
  const today = useMemo(() => new Date(), []);
  const initialGroupId = initialMeeting?.groupId ?? null;

  const [state, dispatch] = useReducer(meetingEditReducer, {
    title: initialMeeting?.title ?? "",
    meetingDate: initialMeeting?.meetingDate ?? "",
    groupId: initialGroupId,
    selectedDate: parseYmdDate(initialMeeting?.meetingDate ?? ""),
    saving: false,
  });
  const { title, meetingDate, groupId, selectedDate, saving } = state;

  if (!initialMeeting) {
    return (
      <PageShell>
        <SectionCard className="rounded-xl px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">Reunião não encontrada.</p>
          <Button
            type="button"
            className="mt-4 rounded-full px-6"
            onClick={() => router.push("/dashboard/meetings")}
          >
            Voltar
          </Button>
        </SectionCard>
      </PageShell>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      show("Preencha o título da reunião.", "warning");
      return;
    }
    if (!meetingDate) {
      show("Selecione a data da reunião.", "warning");
      return;
    }

    const meetingDateError = validateMeetingDate(meetingDate);
    if (meetingDateError) {
      show(meetingDateError, "warning");
      return;
    }

    dispatch({ type: "savingChanged", value: true });
    try {
      await updateMeetingEditableFields(id, {
        title: trimmedTitle,
        meetingDate,
      });
      if (groupId !== initialGroupId) {
        await assignMeetingToGroup(id, groupId);
      }
      show("Reunião atualizada com sucesso.", "success");
      router.push(`/dashboard/meetings/${id}`);
    } catch (error) {
      show(
        error instanceof Error ? error.message : "Erro ao salvar reunião.",
        "error"
      );
      dispatch({ type: "savingChanged", value: false });
    }
  }

  return (
    <PageShell>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Reuniões", href: "/dashboard/meetings" },
          { label: "Editar" },
        ]}
        title="Editar reunião"
        description="Atualize as informações principais da reunião."
      />

      <SectionCard className="mt-6 rounded-xl">
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Título
            </label>
            <Input
              value={title}
              onChange={(event) =>
                dispatch({ type: "titleChanged", value: event.target.value })
              }
              placeholder="Título da reunião"
              className="h-10 rounded-lg"
              disabled={saving}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Grupo
            </label>
            <Select
              value={groupId ?? NO_GROUP_VALUE}
              onValueChange={(value) =>
                dispatch({
                  type: "groupChanged",
                  value: value === NO_GROUP_VALUE ? null : value,
                })
              }
              disabled={saving}
            >
              <SelectTrigger className="h-10 rounded-lg">
                <SelectValue placeholder="Sem grupo" />
              </SelectTrigger>
              <SelectContent className="animate-none">
                <SelectItem value={NO_GROUP_VALUE}>Sem grupo</SelectItem>
                {initialMeeting.meetingGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Data da reunião
            </label>
            <DatePicker
              value={selectedDate}
              onChange={(date) => dispatch({ type: "dateChanged", value: date })}
              maxDate={today}
              placeholder="Selecione a data"
              disabled={saving}
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full px-5"
              onClick={() => router.push(`/dashboard/meetings/${id}`)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" className="rounded-full px-5" disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </form>
      </SectionCard>
    </PageShell>
  );
}
