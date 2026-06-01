"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { buildEmailReturnEvent } from "@/lib/email/return-tracking";

function markCaptured(key: string): boolean {
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

export function EmailReturnTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const event = buildEmailReturnEvent(new URLSearchParams(searchParams.toString()));
    if (!event) return;

    const key = `notura:${event.event}:${event.properties.campaign}`;
    if (!markCaptured(key)) return;

    posthog.capture(event.event, event.properties);
  }, [searchParams]);

  return null;
}
