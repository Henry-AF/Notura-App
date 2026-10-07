"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { DEMO_MEETING, DEMO_PROCESSING_STEPS } from "@/lib/onboarding-funnel/demo-meeting";
import { cn } from "@/lib/utils";

const STEP_DURATION_MS = 1100;

interface DemoProcessingStepProps {
  onFinished: () => void;
}

/** Simulated processing of the demo meeting. Local only — no request is made. */
export function DemoProcessingStep({ onFinished }: DemoProcessingStepProps) {
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (done >= DEMO_PROCESSING_STEPS.length) {
      onFinished();
      return;
    }
    const timer = setTimeout(() => setDone((count) => count + 1), STEP_DURATION_MS);
    return () => clearTimeout(timer);
    // One-shot transition: re-running on a new callback identity would restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  return (
    <section className="space-y-6" aria-live="polite">
      <div className="space-y-2">
        <span className="inline-flex rounded-full bg-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-primary">
          {DEMO_MEETING.dateLabel}
        </span>
        <h1 className="font-display text-2xl font-bold text-foreground">{DEMO_MEETING.title}</h1>
        <p className="text-sm text-muted-foreground">O Notura está organizando esta reunião agora.</p>
      </div>
      <TranscriptPreview />
      <ul className="space-y-3">
        {DEMO_PROCESSING_STEPS.map((label, index) => (
          <ProcessingItem key={label} label={label} done={index < done} active={index === done} />
        ))}
      </ul>
    </section>
  );
}

function TranscriptPreview() {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-4">
      {DEMO_MEETING.transcript.map((line) => (
        <p key={line.speaker} className="text-sm leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">{line.speaker}: </span>
          {line.text}
        </p>
      ))}
    </div>
  );
}

interface ProcessingItemProps {
  label: string;
  done: boolean;
  active: boolean;
}

function ProcessingItem({ label, done, active }: ProcessingItemProps) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 text-sm",
        done || active ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-primary">
        {done ? <Check className="size-3.5" /> : active ? <Loader2 className="size-3.5 animate-spin" /> : null}
      </span>
      {label}
    </li>
  );
}
