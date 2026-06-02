"use client";

import * as React from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";

type VariableSpeed = {
  min: number;
  max: number;
};

export interface TextTypeProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  text: string | string[];
  as?: React.ElementType;
  typingSpeed?: number;
  initialDelay?: number;
  pauseDuration?: number;
  deletingSpeed?: number;
  loop?: boolean;
  showCursor?: boolean;
  hideCursorWhileTyping?: boolean;
  cursorCharacter?: React.ReactNode;
  cursorBlinkDuration?: number;
  cursorClassName?: string;
  textColors?: string[];
  variableSpeed?: VariableSpeed;
  onSentenceComplete?: (sentence: string, index: number) => void;
  startOnVisible?: boolean;
  reverseMode?: boolean;
}

type TextTypeState = {
  displayedText: string;
  currentCharIndex: number;
  isDeleting: boolean;
  currentTextIndex: number;
  isVisible: boolean;
};

type TextTypeAction =
  | { type: "visible" }
  | { type: "advanceText"; textCount: number }
  | { type: "deleteChar" }
  | { type: "typeChar"; char: string }
  | { type: "startDeleting" };

function textTypeReducer(
  state: TextTypeState,
  action: TextTypeAction
): TextTypeState {
  switch (action.type) {
    case "visible":
      return { ...state, isVisible: true };
    case "advanceText":
      return {
        ...state,
        isDeleting: false,
        currentTextIndex: (state.currentTextIndex + 1) % action.textCount,
        currentCharIndex: 0,
      };
    case "deleteChar":
      return {
        ...state,
        displayedText: state.displayedText.slice(0, -1),
        currentCharIndex: Math.max(state.currentCharIndex - 1, 0),
      };
    case "typeChar":
      return {
        ...state,
        displayedText: state.displayedText + action.char,
        currentCharIndex: state.currentCharIndex + 1,
      };
    case "startDeleting":
      return { ...state, isDeleting: true };
  }
}

export default function TextType({
  text,
  as: Component = "div",
  className,
  typingSpeed = 50,
  initialDelay = 0,
  pauseDuration = 2000,
  deletingSpeed = 30,
  loop = true,
  showCursor = true,
  hideCursorWhileTyping = false,
  cursorCharacter = "|",
  cursorBlinkDuration = 0.5,
  cursorClassName,
  textColors = [],
  variableSpeed,
  onSentenceComplete,
  startOnVisible = false,
  reverseMode = false,
  ...props
}: TextTypeProps) {
  const [state, dispatch] = React.useReducer(textTypeReducer, {
    displayedText: "",
    currentCharIndex: 0,
    isDeleting: false,
    currentTextIndex: 0,
    isVisible: !startOnVisible,
  });
  const {
    displayedText,
    currentCharIndex,
    isDeleting,
    currentTextIndex,
    isVisible,
  } = state;

  const cursorRef = React.useRef<HTMLSpanElement | null>(null);
  const containerRef = React.useRef<HTMLElement | null>(null);
  const textArray = React.useMemo(
    () => (Array.isArray(text) ? text : [text]),
    [text]
  );

  const getTypingSpeed = React.useCallback(() => {
    if (!variableSpeed) return typingSpeed;
    const { min, max } = variableSpeed;
    return Math.random() * (max - min) + min;
  }, [typingSpeed, variableSpeed]);

  const currentTextColor =
    textColors.length > 0
      ? textColors[currentTextIndex % textColors.length]
      : "inherit";

  React.useEffect(() => {
    if (!startOnVisible || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            dispatch({ type: "visible" });
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [startOnVisible]);

  React.useEffect(() => {
    if (!showCursor || !cursorRef.current) return;

    gsap.set(cursorRef.current, { opacity: 1 });
    const tween = gsap.to(cursorRef.current, {
      opacity: 0,
      duration: cursorBlinkDuration,
      repeat: -1,
      yoyo: true,
      ease: "power2.inOut",
    });

    return () => {
      tween.kill();
    };
  }, [cursorBlinkDuration, showCursor]);

  React.useEffect(() => {
    if (!isVisible) return;

    const currentSentence = textArray[currentTextIndex] ?? "";
    const processedSentence = reverseMode
      ? currentSentence.split("").reverse().join("")
      : currentSentence;

    let timeout: number | undefined;

    if (isDeleting) {
      if (displayedText.length === 0) {
        onSentenceComplete?.(textArray[currentTextIndex] ?? "", currentTextIndex);

        if (currentTextIndex === textArray.length - 1 && !loop) {
          return;
        }

        timeout = window.setTimeout(() => {
          dispatch({ type: "advanceText", textCount: textArray.length });
        }, pauseDuration);
      } else {
        timeout = window.setTimeout(() => {
          dispatch({ type: "deleteChar" });
        }, deletingSpeed);
      }

      return () => window.clearTimeout(timeout);
    }

    if (currentCharIndex < processedSentence.length) {
      const delay = displayedText === "" && currentCharIndex === 0 ? initialDelay : 0;
      timeout = window.setTimeout(() => {
        dispatch({ type: "typeChar", char: processedSentence[currentCharIndex] });
      }, delay + getTypingSpeed());

      return () => window.clearTimeout(timeout);
    }

    if (!loop && currentTextIndex === textArray.length - 1) {
      return;
    }

    timeout = window.setTimeout(() => {
      dispatch({ type: "startDeleting" });
    }, pauseDuration);

    return () => window.clearTimeout(timeout);
  }, [
    currentCharIndex,
    currentTextIndex,
    deletingSpeed,
    displayedText,
    getTypingSpeed,
    initialDelay,
    isDeleting,
    isVisible,
    loop,
    onSentenceComplete,
    pauseDuration,
    reverseMode,
    textArray,
  ]);

  const shouldHideCursor =
    hideCursorWhileTyping &&
    (currentCharIndex < (textArray[currentTextIndex] ?? "").length || isDeleting);

  return (
    <Component
      ref={containerRef}
      className={cn("inline-block whitespace-pre-wrap", className)}
      {...props}
    >
      <span style={{ color: currentTextColor }}>{displayedText}</span>
      {showCursor ? (
        <span
          ref={cursorRef}
          className={cn(
            "ml-1 inline-block",
            shouldHideCursor && "hidden",
            cursorClassName
          )}
        >
          {cursorCharacter}
        </span>
      ) : null}
    </Component>
  );
}
