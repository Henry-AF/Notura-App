"use client";

import React from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";

export interface OnboardingStep {
  target: string | null;
  title: string;
  description: string;
  waitForElement?: boolean;
  allowInteraction?: boolean;
}

interface OnboardingTourProps {
  steps: OnboardingStep[];
  onComplete: () => void | Promise<void>;
  onSkip: () => void | Promise<void>;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface HighlightedElementState {
  position: string;
  zIndex: string;
  isolation: string;
  pointerEvents: string;
}

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_GAP = 16;
const DESKTOP_TOOLTIP_WIDTH = 320;
const MOBILE_TOOLTIP_HEIGHT = 244;
const MOBILE_TOOLTIP_STYLE = {
  position: "fixed" as const,
  bottom: 0,
  left: 0,
  right: 0,
  top: "auto",
  width: "100%",
  borderRadius: "16px 16px 0 0",
  padding: "24px 20px 32px",
  zIndex: 10000,
  transform: "none",
};

function isMobileViewport() {
  return window.innerWidth < DESKTOP_BREAKPOINT;
}

function getSpotlightPadding() {
  return isMobileViewport() ? 6 : 8;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getTargetElement(target: string | null) {
  if (!target) return null;
  return document.querySelector(`[data-onboarding="${target}"]`);
}

function isRectOutsideViewport(rect: DOMRect) {
  return (
    rect.top < 0 ||
    rect.left < 0 ||
    rect.bottom > window.innerHeight ||
    rect.right > window.innerWidth
  );
}

function buildSpotlightRect(rect: DOMRect): SpotlightRect {
  const padding = getSpotlightPadding();
  return {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

function getDesktopTooltipPosition(
  spotlight: SpotlightRect | null,
  tooltipHeight: number
) {
  if (!spotlight) {
    return {
      top: window.innerHeight / 2,
      left: window.innerWidth / 2,
      centered: true,
    };
  }

  const maxLeft = window.innerWidth - DESKTOP_TOOLTIP_WIDTH - DESKTOP_GAP;
  const fitsRight =
    spotlight.left + spotlight.width + DESKTOP_GAP + DESKTOP_TOOLTIP_WIDTH <=
    window.innerWidth - DESKTOP_GAP;
  const fitsBelow =
    spotlight.top + spotlight.height + DESKTOP_GAP + tooltipHeight <=
    window.innerHeight - DESKTOP_GAP;
  const left = fitsRight
    ? spotlight.left + spotlight.width + DESKTOP_GAP
    : clamp(spotlight.left, DESKTOP_GAP, maxLeft);
  const top = fitsRight
    ? clamp(
        spotlight.top,
        DESKTOP_GAP,
        window.innerHeight - tooltipHeight - DESKTOP_GAP
      )
    : fitsBelow
      ? spotlight.top + spotlight.height + DESKTOP_GAP
      : spotlight.top - tooltipHeight - DESKTOP_GAP;

  return {
    top: clamp(
      top,
      DESKTOP_GAP,
      window.innerHeight - tooltipHeight - DESKTOP_GAP
    ),
    left,
    centered: false,
  };
}

function restoreHighlightedElement(
  elementRef: React.MutableRefObject<HTMLElement | null>,
  stateRef: React.MutableRefObject<HighlightedElementState | null>
) {
  const element = elementRef.current;
  const previous = stateRef.current;
  if (!element || !previous) return;

  element.style.position = previous.position;
  element.style.zIndex = previous.zIndex;
  element.style.isolation = previous.isolation;
  element.style.pointerEvents = previous.pointerEvents;
  elementRef.current = null;
  stateRef.current = null;
}

function highlightElement(
  element: HTMLElement,
  allowInteraction: boolean,
  elementRef: React.MutableRefObject<HTMLElement | null>,
  stateRef: React.MutableRefObject<HighlightedElementState | null>
) {
  if (elementRef.current !== element) {
    restoreHighlightedElement(elementRef, stateRef);
    stateRef.current = {
      position: element.style.position,
      zIndex: element.style.zIndex,
      isolation: element.style.isolation,
      pointerEvents: element.style.pointerEvents,
    };
    if (window.getComputedStyle(element).position === "static") {
      element.style.position = "relative";
    }
    elementRef.current = element;
  }

  element.style.zIndex = "9999";
  element.style.isolation = "isolate";
  element.style.pointerEvents = allowInteraction ? "auto" : "none";
}

function waitForTargetElement(
  target: string,
  onReady: () => void,
  onTimeout: () => void
) {
  const intervalId = window.setInterval(() => {
    if (getTargetElement(target)) {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
      onReady();
    }
  }, 200);

  const timeoutId = window.setTimeout(() => {
    window.clearInterval(intervalId);
    onTimeout();
  }, 5000);

  return () => {
    window.clearInterval(intervalId);
    window.clearTimeout(timeoutId);
  };
}

function useViewportMode() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const update = () => setIsMobile(isMobileViewport());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return isMobile;
}

function useSpotlight(step: OnboardingStep) {
  const [spotlight, setSpotlight] = React.useState<SpotlightRect | null>(null);
  const [waitingForTarget, setWaitingForTarget] = React.useState(false);
  const elementRef = React.useRef<HTMLElement | null>(null);
  const elementStateRef = React.useRef<HighlightedElementState | null>(null);

  const updateSpotlight = React.useCallback(
    (allowScroll: boolean) => {
      if (!step.target) {
        restoreHighlightedElement(elementRef, elementStateRef);
        setSpotlight(null);
        setWaitingForTarget(false);
        return;
      }

      const target = getTargetElement(step.target);
      if (!(target instanceof HTMLElement)) {
        restoreHighlightedElement(elementRef, elementStateRef);
        setSpotlight(null);
        setWaitingForTarget(Boolean(step.waitForElement));
        return;
      }

      const rect = target.getBoundingClientRect();
      if (allowScroll && isRectOutsideViewport(rect)) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        });
        window.setTimeout(() => updateSpotlight(false), 400);
        return;
      }

      highlightElement(
        target,
        step.allowInteraction === true,
        elementRef,
        elementStateRef
      );
      setSpotlight(buildSpotlightRect(target.getBoundingClientRect()));
      setWaitingForTarget(false);
    },
    [step.allowInteraction, step.target, step.waitForElement]
  );

  React.useEffect(() => {
    let stopWaiting: (() => void) | null = null;
    let frameId = window.requestAnimationFrame(() => updateSpotlight(true));

    if (step.target && step.waitForElement) {
      stopWaiting = waitForTargetElement(
        step.target,
        () => updateSpotlight(true),
        () => setWaitingForTarget(false)
      );
    }

    const recalculate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => updateSpotlight(false));
    };

    window.addEventListener("resize", recalculate);
    window.addEventListener("scroll", recalculate, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", recalculate);
      window.removeEventListener("scroll", recalculate, true);
      stopWaiting?.();
      restoreHighlightedElement(elementRef, elementStateRef);
    };
  }, [step.target, step.waitForElement, updateSpotlight]);

  return { spotlight, waitingForTarget };
}

export function OnboardingTour({ steps, onComplete, onSkip }: OnboardingTourProps) {
  const [mounted, setMounted] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const isMobile = useViewportMode();
  const step = steps[stepIndex];
  const { spotlight, waitingForTarget } = useSpotlight(step);

  const handleSkip = React.useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSkip();
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, onSkip]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void handleSkip();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleSkip, mounted]);

  const tooltipPosition = React.useMemo(() => {
    if (!mounted || isMobile) {
      return { top: 0, left: 0, centered: false };
    }

    const tooltipHeight = tooltipRef.current?.getBoundingClientRect().height ?? 260;
    return getDesktopTooltipPosition(spotlight, tooltipHeight);
  }, [isMobile, mounted, spotlight, stepIndex, waitingForTarget]);

  const handleNext = React.useCallback(async () => {
    if (isSubmitting) return;

    if (stepIndex === steps.length - 1) {
      setIsSubmitting(true);
      try {
        await onComplete();
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setStepIndex((current) => current + 1);
  }, [isSubmitting, onComplete, stepIndex, steps.length]);

  if (!mounted) return null;

  const tooltipStyle = isMobile
    ? {
        ...MOBILE_TOOLTIP_STYLE,
        background: "rgb(26 26 46 / 0.96)",
        borderColor: "rgba(255,255,255,0.08)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        minHeight: MOBILE_TOOLTIP_HEIGHT,
      }
    : {
        position: "fixed" as const,
        width: "320px",
        zIndex: 10000,
        background: "rgb(26 26 46 / 0.96)",
        borderColor: "rgba(255,255,255,0.08)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      };

  return createPortal(
    <div className="fixed inset-0 z-[9998]">
      <div
        className={
          step.allowInteraction
            ? "pointer-events-none absolute inset-0 bg-black/78"
            : "absolute inset-0 bg-black/78"
        }
        onClick={() => {
          if (isMobile) {
            void handleSkip();
          }
        }}
      />

      {spotlight ? (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-[10px]"
          initial={false}
          animate={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          style={{
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.78)",
            border: "1px solid rgba(255,255,255,0.18)",
            zIndex: 9998,
          }}
        />
      ) : null}

      <motion.div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        initial={false}
        animate={
          isMobile
            ? { opacity: 1 }
            : {
                opacity: 1,
                top: tooltipPosition.top,
                left: tooltipPosition.left,
                x: tooltipPosition.centered ? "-50%" : "0%",
                y: tooltipPosition.centered ? "-50%" : "0%",
              }
        }
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        className={
          isMobile
            ? "fixed border text-white shadow-2xl"
            : "fixed z-[10001] w-[320px] rounded-[12px] border p-5 text-white shadow-2xl"
        }
        style={tooltipStyle}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
              Etapa {stepIndex + 1} de {steps.length}
            </p>
            <h2 className="mt-2 text-lg font-semibold leading-tight text-white">
              {step.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => void handleSkip()}
            disabled={isSubmitting}
            className="text-[13px] text-white/45 transition-colors hover:text-white disabled:opacity-60"
          >
            Pular tour
          </button>
        </div>

        <p className="mt-3 text-sm leading-6 text-white/72">{step.description}</p>
        {waitingForTarget ? (
          <p className="mt-2 text-xs text-white/55">
            Aguarde o elemento aparecer ou interaja com a tela para continuar esta etapa.
          </p>
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
            disabled={stepIndex === 0 || isSubmitting}
            className="rounded-full px-4 py-2 text-sm font-medium text-white/72 transition-colors hover:bg-white/8 hover:text-white disabled:pointer-events-none disabled:opacity-35"
          >
            ← Voltar
          </button>

          <button
            type="button"
            onClick={() => void handleNext()}
            disabled={isSubmitting}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{
              background: "#7C3AED",
              boxShadow: "0 10px 24px rgba(124,58,237,0.28)",
            }}
          >
            {stepIndex === steps.length - 1 ? "Concluir" : "Próximo →"}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}