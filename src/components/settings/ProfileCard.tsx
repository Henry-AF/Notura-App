"use client";

import React, { useRef, useState } from "react";
import { Pencil } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProfileCardProps {
  name: string;
  subtitle: string;
  company: string;
  email: string;
  avatarUrl?: string;
  onSave: (data: { company: string; email: string }) => void;
}

// ─── Shared input style ───────────────────────────────────────────────────────

const inputCls =
  "w-full appearance-none rounded-lg border border-[#3A3A3A] bg-[#242424] px-[14px] py-2.5 text-sm text-white outline-none placeholder-[#606060] transition-colors focus:border-[#6851FF]";

const labelCls =
  "mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-[#606060]";

// ─── Component ────────────────────────────────────────────────────────────────

export function ProfileCard({
  name,
  subtitle,
  company: initialCompany,
  email: initialEmail,
  avatarUrl,
  onSave,
}: ProfileCardProps) {
  const [company, setCompany] = useState(initialCompany);
  const [email, setEmail] = useState(initialEmail);
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const handleBlur = () => {
    onSave({ company, email });
  };

  return (
    <div
      className="rounded-2xl border p-6"
      style={{ background: "#1C1C1C", borderColor: "#2E2E2E" }}
    >
      {/* Top row: avatar + name */}
      <div className="flex items-start gap-5">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full"
            style={{
              background: avatarUrl
                ? undefined
                : "linear-gradient(135deg, #3B2A7A, #7C3AED)",
            }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="font-display text-2xl font-bold text-white">
                {initials}
              </span>
            )}
          </div>

          {/* Edit button */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full shadow-md transition-opacity hover:opacity-90"
            style={{ background: "#6851FF" }}
            aria-label="Editar avatar"
          >
            <Pencil className="h-3 w-3 text-white" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" />
        </div>

        {/* Name + subtitle */}
        <div>
          <h2 className="font-display text-[22px] font-bold text-white leading-tight">
            {name}
          </h2>
          <p className="mt-1 text-[13px] text-[#A0A0A0]">{subtitle}</p>
        </div>
      </div>

      {/* Inputs */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Empresa</label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === "Enter" && handleBlur()}
            className={inputCls}
            placeholder="Nome da empresa"
          />
        </div>
        <div>
          <label className={labelCls}>E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === "Enter" && handleBlur()}
            className={inputCls}
            placeholder="seu@email.com"
          />
        </div>
      </div>
    </div>
  );
}
