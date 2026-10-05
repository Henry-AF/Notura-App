"use client";

import type { ReactNode } from "react";
import { CalendarClock, CheckCircle2, ListChecks, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DemoMeeting } from "@/lib/onboarding-funnel/demo-meeting";

interface DemoResultProps {
  meeting: DemoMeeting;
}

/** The Aha Moment: summary, decisions, tasks, next steps and participants of the demo meeting. */
export function DemoResult({ meeting }: DemoResultProps) {
  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <Badge variant="completed">{meeting.dateLabel}</Badge>
        <h1 className="font-display text-3xl font-extrabold leading-tight text-foreground">
          Sua reunião virou ação.
        </h1>
        <p className="text-sm text-muted-foreground">{meeting.title}</p>
      </div>

      <ResultCard title="Resumo" icon={<CalendarClock className="size-4" />}>
        <p className="text-[15px] leading-relaxed text-foreground">{meeting.summary}</p>
      </ResultCard>

      <ResultCard title="Decisões" icon={<CheckCircle2 className="size-4" />}>
        <BulletList items={meeting.decisions} />
      </ResultCard>

      <ResultCard title="Tarefas" icon={<ListChecks className="size-4" />}>
        <TaskList tasks={meeting.tasks} />
      </ResultCard>

      <ResultCard title="Próximos passos" icon={<ListChecks className="size-4" />}>
        <BulletList items={meeting.nextSteps} />
      </ResultCard>

      <ResultCard title="Participantes reconhecidos" icon={<Users className="size-4" />}>
        <ParticipantList participants={meeting.participants} />
      </ResultCard>
    </section>
  );
}

interface ResultCardProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

function ResultCard({ title, icon, children }: ResultCardProps) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="space-y-3 p-5">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-primary">
          {icon}
          {title}
        </h2>
        {children}
      </CardContent>
    </Card>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-[15px] leading-relaxed text-foreground">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function TaskList({ tasks }: { tasks: DemoMeeting["tasks"] }) {
  return (
    <ul className="divide-y divide-border">
      {tasks.map((task) => (
        <li
          key={task.owner}
          className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
        >
          <div>
            <p className="text-xs font-semibold text-primary">{task.owner}</p>
            <p className="text-[15px] font-medium text-foreground">{task.title}</p>
          </div>
          <Badge variant="processing" className="shrink-0">
            {task.dueLabel}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

function ParticipantList({ participants }: { participants: DemoMeeting["participants"] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {participants.map((person) => (
        <li key={person.name} className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
              {person.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground">{person.name}</p>
            <p className="text-xs text-muted-foreground">{person.role}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
