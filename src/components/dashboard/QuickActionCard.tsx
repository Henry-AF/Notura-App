"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Grainient } from "@/components/ui/grainient";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuickActionCardColors {
  color1: string;
  color2: string;
  color3: string;
}

export interface QuickActionCardProps {
  label: string;
  href: string;
  colors: QuickActionCardColors;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuickActionCard({ label, href, colors }: QuickActionCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex h-32 w-full flex-col justify-end overflow-hidden rounded-lg border border-white/20 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      {/* Grainient background fills the card */}
      <div className="absolute inset-0">
        <Grainient
          color1={colors.color1}
          color2={colors.color2}
          color3={colors.color3}
          timeSpeed={0.12}
          grainAmount={0.055}
          zoom={0.85}
          warpStrength={0.7}
          contrast={1.15}
          saturation={0.85}
        />
      </div>

      {/* Label + animated arrow */}
      <div className="relative z-10 flex items-end justify-between gap-2">
        <p className="text-[13px] font-bold leading-snug text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.4)]">
          {label}
        </p>
        <ArrowRight className="h-4 w-4 shrink-0 text-white/80 transition-transform duration-200 group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
