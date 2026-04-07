"use client";

import React, { useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { useThemeColors } from "@/lib/theme-context";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProfileCardProps {
  name: string;
  subtitle: string;
  company: string;
  email: string;
  avatarUrl?: string;
  onSave: (data: { name: string; company: string; email: string }) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProfileCard({
  name: initialName,
  subtitle,
  company: initialCompany,
  email: initialEmail,
  avatarUrl,
  onSave,
}: ProfileCardProps) {
  const c = useThemeColors();
  const [name, setName] = useState(initialName);
  const [company, setCompany] = useState(initialCompany);
  const [email, setEmail] = useState(initialEmail);
  const fileRef = useRef<HTMLInputElement>(null);

  const inputCls = `w-full appearance-none rounded-lg border px-[14px] py-2.5 text-sm outline-none transition-colors focus:border-[#6851FF]`;
  const inputStyle = { background: c.inputBg, borderColor: c.inputBorder, color: c.ink };
  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "6px",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: c.ink3,
  };

  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const handleBlur = () => {
    onSave({ name, company, email });
  };

  return (
    <div
      className="rounded-2xl border p-6"
      style={{ background: c.card, borderColor: c.border }}
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

        {/* Name (editable) + subtitle */}
        <div className="flex-1">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === "Enter" && handleBlur()}
            className="w-full bg-transparent font-display text-[22px] font-bold leading-tight outline-none focus:underline decoration-notura-primary/60 underline-offset-2"
            style={{ color: c.ink }}
            placeholder="Seu nome"
            aria-label="Nome de usuário"
          />
          <p className="mt-1 text-[13px]" style={{ color: c.ink2 }}>{subtitle}</p>
        </div>
      </div>

      {/* Inputs */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label style={labelStyle}>Empresa</label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === "Enter" && handleBlur()}
            className={inputCls}
            style={inputStyle}
            placeholder="Nome da empresa"
          />
        </div>
        <div>
          <label style={labelStyle}>E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === "Enter" && handleBlur()}
            className={inputCls}
            style={inputStyle}
            placeholder="seu@email.com"
          />
        </div>
      </div>
    </div>
  );
}
