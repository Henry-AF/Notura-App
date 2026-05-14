"use client";

import * as React from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

type SplitMode = "chars" | "words" | "lines" | "words, chars";

export interface SplitTextProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  tag?: keyof JSX.IntrinsicElements;
  text?: string;
  children?: React.ReactNode;
  delay?: number;
  duration?: number;
  ease?: string;
  splitType?: SplitMode;
  from?: gsap.TweenVars;
  to?: gsap.TweenVars;
  textAlign?: React.CSSProperties["textAlign"];
  onLetterAnimationComplete?: () => void;
}

function splitStringContent(
  value: string,
  splitType: SplitMode,
  keyPrefix: string
) {
  if (splitType === "chars") {
    return value.split("").map((character, index) => {
      if (/\s/.test(character)) {
        return <React.Fragment key={`${keyPrefix}-${index}`}>{character}</React.Fragment>;
      }

      return (
        <span
          key={`${keyPrefix}-${index}`}
          data-split-item
          className="inline-block will-change-transform"
        >
          {character}
        </span>
      );
    });
  }

  return value.split(/(\s+)/).map((segment, index) => {
    if (!segment) return null;
    if (/^\s+$/.test(segment)) {
      return <React.Fragment key={`${keyPrefix}-${index}`}>{segment}</React.Fragment>;
    }

    return (
      <span
        key={`${keyPrefix}-${index}`}
        data-split-item
        className="inline-block will-change-transform"
      >
        {segment}
      </span>
    );
  });
}

function splitNode(
  node: React.ReactNode,
  splitType: SplitMode,
  keyPrefix: string
): React.ReactNode {
  if (node == null || typeof node === "boolean") return null;

  if (typeof node === "string" || typeof node === "number") {
    return splitStringContent(String(node), splitType, keyPrefix);
  }

  if (Array.isArray(node)) {
    return node.map((child, index) => splitNode(child, splitType, `${keyPrefix}-${index}`));
  }

  if (React.isValidElement(node)) {
    if (node.type === React.Fragment) {
      return splitNode(node.props.children, splitType, `${keyPrefix}-fragment`);
    }

    return (
      <span
        key={keyPrefix}
        data-split-item
        className="inline-block align-baseline will-change-transform"
      >
        {node}
      </span>
    );
  }

  return null;
}

export default function SplitText({
  tag = "p",
  text,
  children,
  className,
  delay = 50,
  duration = 1.25,
  ease = "power3.out",
  splitType = "chars",
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  textAlign = "center",
  onLetterAnimationComplete,
  ...props
}: SplitTextProps) {
  const ref = React.useRef<HTMLElement | null>(null);
  const content = text ?? children;

  useGSAP(
    () => {
      if (!ref.current) return;

      const targets = ref.current.querySelectorAll<HTMLElement>("[data-split-item]");
      if (!targets.length) return;

      gsap.set(targets, from);

      return gsap.to(targets, {
        ...to,
        duration,
        ease,
        stagger: delay / 1000,
        clearProps: "opacity,transform",
        onComplete: onLetterAnimationComplete,
      });
    },
    {
      dependencies: [
        delay,
        duration,
        ease,
        splitType,
        JSON.stringify(from),
        JSON.stringify(to),
        text,
        children,
        onLetterAnimationComplete,
      ],
      scope: ref,
      revertOnUpdate: true,
    }
  );

  return React.createElement(
    tag,
    {
      ref,
      className: cn("inline-block overflow-hidden whitespace-normal", className),
      style: {
        textAlign,
        wordWrap: "break-word",
        willChange: "transform, opacity",
      },
      ...props,
    },
    splitNode(content, splitType, "split")
  );
}