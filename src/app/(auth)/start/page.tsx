"use client";

import { Suspense, useEffect, useReducer, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  AhaCta,
  DemoProcessingStep,
  DemoResult,
  FunnelLayout,
  ObjectionsStep,
  OptionList,
  PromiseStep,
  QuestionStep,
} from "@/components/onboarding-funnel";
import {
  FREQUENCY_CONTEXT,
  FREQUENCY_CONTEXT_FOOTER,
  FREQUENCY_OPTIONS,
  GOAL_OPTIONS,
  PROBLEM_OPTIONS,
  PROFILE_OPTIONS,
  getEntryContent,
  resolvePromise,
} from "@/lib/onboarding-funnel/content";
import { trackFunnelEvent } from "@/lib/onboarding-funnel/analytics";
import { DEMO_MEETING } from "@/lib/onboarding-funnel/demo-meeting";
import {
  canGoBack,
  createInitialState,
  getProgress,
  onboardingReducer,
  type OnboardingAction,
} from "@/lib/onboarding-funnel/engine";
import type { OnboardingState } from "@/lib/onboarding-funnel/types";
import { buildSignupHref, hydrateFunnel, persistFunnel } from "./start-api";

const AUTO_ADVANCE_MS = 180;

export default function StartPage() {
  return (
    <Suspense fallback={<FunnelLoading />}>
      <StartFunnel />
    </Suspense>
  );
}

function FunnelLoading() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-primary" aria-label="Carregando" />
    </main>
  );
}

function StartFunnel() {
  const router = useRouter();
  const campaignParam = useSearchParams().get("campaign");
  const [state, dispatch] = useReducer(onboardingReducer, undefined, () => createInitialState());
  const [ready, setReady] = useState(false);
  const trackedStep = useRef<string | null>(null);

  useEffect(() => {
    const { state: hydrated, resumed } = hydrateFunnel(campaignParam);
    dispatch({ type: "restored", state: hydrated });
    if (!resumed) trackFunnelEvent("onboarding_started", hydrated);
    setReady(true);
  }, [campaignParam]);

  useEffect(() => {
    if (!ready) return;
    persistFunnel(state);
    if (trackedStep.current === state.currentStep) return;
    trackedStep.current = state.currentStep;
    trackStepViewed(state);
  }, [ready, state]);

  if (!ready) return <FunnelLoading />;

  return (
    <FunnelLayout
      progress={getProgress(state.currentStep)}
      canGoBack={canGoBack(state.currentStep)}
      onBack={() => dispatch({ type: "back" })}
      wide={state.currentStep === "aha"}
    >
      <StepSwitch
        state={state}
        dispatch={dispatch}
        onSignup={() => handleSignup(state, dispatch, () => router.push(buildSignupHref(state)))}
        onExplore={() => router.push("/login")}
      />
    </FunnelLayout>
  );
}

function trackStepViewed(state: OnboardingState): void {
  if (state.currentStep === "promise") trackFunnelEvent("onboarding_promise_viewed", state);
  if (state.currentStep === "demo") trackFunnelEvent("demo_meeting_opened", state);
  if (state.currentStep === "aha") {
    trackFunnelEvent("demo_meeting_result_viewed", state, { meetingId: DEMO_MEETING.id });
    trackFunnelEvent("aha_moment_reached", state);
  }
}

function handleSignup(
  state: OnboardingState,
  dispatch: (action: OnboardingAction) => void,
  navigate: () => void
): void {
  dispatch({ type: "completed" });
  trackFunnelEvent("onboarding_completed", state);
  trackFunnelEvent("signup_started", state);
  persistFunnel({ ...state, completed: true });
  navigate();
}

interface StepSwitchProps {
  state: OnboardingState;
  dispatch: (action: OnboardingAction) => void;
  onSignup: () => void;
  onExplore: () => void;
}

function StepSwitch({ state, dispatch, onSignup, onExplore }: StepSwitchProps) {
  const next = () => dispatch({ type: "next" });

  switch (state.currentStep) {
    case "problem":
      return <ProblemStep state={state} dispatch={dispatch} />;
    case "profile":
      return <ProfileStep state={state} dispatch={dispatch} />;
    case "frequency":
      return <FrequencyStep state={state} dispatch={dispatch} />;
    case "goals":
      return <GoalsStep state={state} dispatch={dispatch} />;
    case "promise":
      return <PromiseStep promise={resolvePromise(state)} onContinue={next} />;
    case "objections":
      return (
        <ObjectionsStep
          onObjectionViewed={(objectionId, index) =>
            trackFunnelEvent("onboarding_objection_viewed", state, { objectionId, index })
          }
          onContinue={next}
        />
      );
    case "demo":
      return <DemoProcessingStep onFinished={next} />;
    case "aha":
      return <AhaStep onSignup={onSignup} onExplore={onExplore} />;
  }
}

interface StepProps {
  state: OnboardingState;
  dispatch: (action: OnboardingAction) => void;
}

/** Advances once after a short delay so the selected state is visible; ignores repeated taps. */
function useAutoAdvance(dispatch: (action: OnboardingAction) => void) {
  const pending = useRef(false);

  return () => {
    if (pending.current) return;
    pending.current = true;
    setTimeout(() => {
      pending.current = false;
      dispatch({ type: "next" });
    }, AUTO_ADVANCE_MS);
  };
}

function ProblemStep({ state, dispatch }: StepProps) {
  const advance = useAutoAdvance(dispatch);

  return (
    <QuestionStep content={getEntryContent(state.campaign)}>
      <OptionList
        options={PROBLEM_OPTIONS}
        selected={state.problem ? [state.problem] : []}
        onSelect={(id) => {
          dispatch({ type: "problemSelected", value: id });
          trackFunnelEvent("onboarding_problem_selected", state, { problem: id });
          advance();
        }}
      />
    </QuestionStep>
  );
}

function ProfileStep({ state, dispatch }: StepProps) {
  const advance = useAutoAdvance(dispatch);

  return (
    <QuestionStep content={{ title: "Qual dessas opções descreve melhor o seu trabalho?" }}>
      <OptionList
        options={PROFILE_OPTIONS}
        selected={state.profile ? [state.profile] : []}
        onSelect={(id) => {
          dispatch({ type: "profileSelected", value: id });
          trackFunnelEvent("onboarding_profile_selected", state, { profile: id });
          advance();
        }}
      />
    </QuestionStep>
  );
}

function FrequencyStep({ state, dispatch }: StepProps) {
  const selected = state.meetingFrequency;

  return (
    <QuestionStep
      content={{ title: "Quantas reuniões você participa por semana?" }}
      ctaLabel="Continuar"
      ctaDisabled={!selected}
      onContinue={() => dispatch({ type: "next" })}
    >
      <OptionList
        options={FREQUENCY_OPTIONS}
        columns={2}
        selected={selected ? [selected] : []}
        onSelect={(id) => {
          dispatch({ type: "frequencySelected", value: id });
          trackFunnelEvent("onboarding_frequency_selected", state, { meetingFrequency: id });
        }}
      />
      {selected ? (
        <p className="mt-5 rounded-xl bg-primary/10 px-4 py-4 text-[15px] leading-relaxed text-foreground">
          {FREQUENCY_CONTEXT[selected]}
          <br />
          <span className="font-semibold">{FREQUENCY_CONTEXT_FOOTER}</span>
        </p>
      ) : null}
    </QuestionStep>
  );
}

function GoalsStep({ state, dispatch }: StepProps) {
  return (
    <QuestionStep
      content={{
        title: "O que você gostaria que o Notura fizesse por você?",
        subtitle: "Pode escolher mais de uma opção.",
      }}
      ctaLabel="Continuar"
      ctaDisabled={state.goals.length === 0}
      onContinue={() => dispatch({ type: "next" })}
    >
      <OptionList
        multiple
        options={GOAL_OPTIONS}
        selected={state.goals}
        onSelect={(id) => {
          dispatch({ type: "goalToggled", value: id });
          trackFunnelEvent("onboarding_goal_selected", state, {
            goal: id,
            selected: !state.goals.includes(id),
          });
        }}
      />
    </QuestionStep>
  );
}

function AhaStep({ onSignup, onExplore }: { onSignup: () => void; onExplore: () => void }) {
  return (
    <div className="space-y-6">
      <DemoResult meeting={DEMO_MEETING} />
      <AhaCta
        primaryLabel="Quero fazer isso com minhas reuniões"
        secondaryLabel="Explorar o Notura"
        onPrimary={onSignup}
        onSecondary={onExplore}
      />
    </div>
  );
}
