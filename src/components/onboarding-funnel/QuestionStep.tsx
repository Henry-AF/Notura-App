"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { OnboardingContent } from "@/lib/onboarding-funnel/types";

interface StepHeadingProps {
  content: OnboardingContent;
}

/** Eyebrow + headline + subtitle used at the top of every question screen. */
export function StepHeading({ content }: StepHeadingProps) {
  return (
    <div className="mb-6 space-y-2">
      {content.eyebrow ? (
        <span className="inline-flex rounded-full bg-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-primary">
          {content.eyebrow}
        </span>
      ) : null}
      <h1 className="font-display text-2xl font-bold leading-tight text-foreground sm:text-3xl">
        {content.title}
      </h1>
      {content.subtitle ? (
        <p className="text-[15px] leading-relaxed text-muted-foreground">{content.subtitle}</p>
      ) : null}
    </div>
  );
}

interface QuestionStepProps {
  content: OnboardingContent;
  children: ReactNode;
  ctaLabel?: string;
  onContinue?: () => void;
  ctaDisabled?: boolean;
}

/** A question screen: heading, the answers (children) and an optional specific CTA. */
export function QuestionStep({
  content,
  children,
  ctaLabel,
  onContinue,
  ctaDisabled = false,
}: QuestionStepProps) {
  return (
    <section>
      <StepHeading content={content} />
      {children}
      {ctaLabel && onContinue ? (
        <Button
          type="button"
          onClick={onContinue}
          disabled={ctaDisabled}
          className="mt-6 h-12 w-full rounded-lg"
        >
          {ctaLabel}
        </Button>
      ) : null}
    </section>
  );
}
