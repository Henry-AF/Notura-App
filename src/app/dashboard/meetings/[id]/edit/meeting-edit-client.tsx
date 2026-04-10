"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useToast } from "@/components/upload/Toast";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageShell, SectionCard } from "@/components/ui/app";
import { validateMeetingDate } from "@/lib/meetings/meeting-date";
import type { MeetingEditData } from "./meeting-edit-types";
import { updateMeetingEditableFields } from "./meeting-edit-client-api";

export interface MeetingEditClientProps {
  id: string;
  initialMeeting: MeetingEditData | null;
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

  const [title, setTitle] = useState(initialMeeting?.title ?? "");
  const [company, setCompany] = useState(initialMeeting?.company ?? "");
  const [meetingDate, setMeetingDate] = useState(initialMeeting?.meetingDate ?? "");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    parseYmdDate(initialMeeting?.meetingDate ?? "")
  );
  const [saving, setSaving] = useState(false);

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
    const trimmedCompany = company.trim();
    if (!trimmedTitle) {
      show("Preencha o título da reunião.", "warning");
      return;
    }
    if (!trimmedCompany) {
      show("Preencha a empresa.", "warning");
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

    setSaving(true);
    try {
      await updateMeetingEditableFields(id, {
        title: trimmedTitle,
        company: trimmedCompany,
        meetingDate,
      });
      show("Reunião atualizada com sucesso.", "success");
      router.push(`/dashboard/meetings/${id}`);
    } catch (error) {
      show(
        error instanceof Error ? error.message : "Erro ao salvar reunião.",
        "error"
      );
      setSaving(false);
    }
  }

  return (
    <PageShell>
      <nav className="mb-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Link href="/dashboard">Dashboard</Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
        <Link href={`/dashboard/meetings/${id}`}>Reunião</Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
        <span className="text-foreground">Editar</span>
      </nav>

      <h1 className="font-display text-3xl font-extrabold text-foreground">
        Editar reunião
      </h1>
      <p className="mt-1.5 max-w-lg text-sm text-muted-foreground">
        Atualize as informações principais da reunião.
      </p>

      <SectionCard className="mt-6 rounded-xl">
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Empresa
            </label>
            <Input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="Nome da empresa"
              className="h-10 rounded-lg"
              disabled={saving}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Título
            </label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Título da reunião"
              className="h-10 rounded-lg"
              disabled={saving}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Data da reunião
            </label>
            <DatePicker
              value={selectedDate}
              onChange={(date) => {
                setSelectedDate(date);
                setMeetingDate(date ? formatDateToYmd(date) : "");
              }}
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
