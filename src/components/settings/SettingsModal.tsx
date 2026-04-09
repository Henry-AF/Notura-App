"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, User, Bell, CreditCard, LogOut, ChevronRight, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useThemeColors, useTheme } from "@/lib/theme-context";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserData {
  name: string;
  email: string;
  company: string;
  plan: string;
  meetingsUsed: number;
  monthlyLimit: number;
}

type Tab = "profile" | "preferences" | "plan";

interface Pref {
  id: string;
  icon: string;
  label: string;
  description: string;
  enabled: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SettingsModal({
  onClose,
  onUpgradeClick,
}: {
  onClose: () => void;
  onUpgradeClick: () => void;
}) {
  const c = useThemeColors();
  const { isDark, setTheme } = useTheme();
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<Tab>("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<UserData>({
    name: "",
    email: "",
    company: "",
    plan: "free",
    meetingsUsed: 0,
    monthlyLimit: 3,
  });
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [prefs, setPrefs] = useState<Pref[]>([
    { id: "whatsapp", icon: "💬", label: "Resumo via WhatsApp", description: "Receba resumos das reuniões no WhatsApp", enabled: true },
    { id: "email", icon: "📧", label: "Notificações por e-mail", description: "Avisos sobre tarefas e prazos", enabled: false },
    { id: "darkMode", icon: "🌙", label: "Modo escuro", description: "Usar tema escuro no painel", enabled: isDark },
  ]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [profileRes, billingRes] = await Promise.all([
        supabase.from("profiles").select("name, company").eq("id", user.id).single(),
        supabase.from("billing_accounts").select("plan, meetings_this_month, monthly_limit").eq("user_id", user.id).maybeSingle(),
      ]);

      const loaded: UserData = {
        name: profileRes.data?.name ?? "",
        email: user.email ?? "",
        company: profileRes.data?.company ?? "",
        plan: billingRes.data?.plan ?? "free",
        meetingsUsed: billingRes.data?.meetings_this_month ?? 0,
        monthlyLimit: billingRes.data?.monthly_limit ?? 3,
      };
      setData(loaded);
      setName(loaded.name);
      setCompany(loaded.company);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleSaveProfile() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ name: name.trim(), company: company.trim() }).eq("id", user.id);
      setData((d) => ({ ...d, name: name.trim(), company: company.trim() }));
    }
    setSaving(false);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initials = data.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  const planLabel = data.plan === "pro" ? "Plano Pro" : data.plan === "team" ? "Plano Team" : "Plano Gratuito";
  const pct = data.monthlyLimit > 0 ? Math.min(100, Math.round((data.meetingsUsed / data.monthlyLimit) * 100)) : 0;

  const inputCls = "w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors";

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: "Perfil", icon: <User className="h-4 w-4" /> },
    { id: "preferences", label: "Preferências", icon: <Bell className="h-4 w-4" /> },
    { id: "plan", label: "Plano", icon: <CreditCard className="h-4 w-4" /> },
  ];

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="relative flex w-full max-w-2xl overflow-hidden rounded-2xl shadow-2xl"
        style={{ background: c.bg2, border: `1px solid ${c.border}`, maxHeight: "90vh" }}
      >
        {/* Left panel — user info + tabs */}
        <div
          className="flex w-56 shrink-0 flex-col"
          style={{ background: c.card2, borderRight: `1px solid ${c.border}` }}
        >
          {/* Avatar + name */}
          <div className="px-5 pt-6 pb-5">
            <div className="relative mx-auto mb-3 h-16 w-16">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white"
                style={{ background: "linear-gradient(135deg, #3B2A7A, #7C3AED)" }}
              >
                {initials}
              </div>
              <button
                className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full text-white"
                style={{ background: "#6851FF" }}
              >
                <Pencil className="h-2.5 w-2.5" />
              </button>
            </div>
            <p className="text-center text-sm font-semibold" style={{ color: c.ink }}>
              {data.name || "Usuário"}
            </p>
            <p className="mt-0.5 text-center text-xs" style={{ color: c.ink3 }}>
              {planLabel}
            </p>
          </div>

          {/* Tabs */}
          <nav className="flex-1 px-3 space-y-0.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
                style={{
                  background: tab === t.id ? "rgba(104,81,255,0.12)" : "transparent",
                  color: tab === t.id ? "#6851FF" : c.ink2,
                }}
              >
                {t.icon}
                {t.label}
                {tab === t.id && <ChevronRight className="ml-auto h-3.5 w-3.5" />}
              </button>
            ))}
          </nav>

          {/* Logout */}
          <div className="px-3 pb-5 pt-3">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
              style={{ color: "#FF6B6B" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,107,107,0.1)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>

        {/* Right panel — content */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-5"
            style={{ borderBottom: `1px solid ${c.border}` }}
          >
            <div>
              <h2 className="text-lg font-bold" style={{ color: c.ink }}>
                {tab === "profile" ? "Dados pessoais" : tab === "preferences" ? "Preferências" : "Plano atual"}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: c.ink3 }}>
                {tab === "profile" ? "Edite suas informações de perfil" : tab === "preferences" ? "Gerencie suas notificações e preferências" : "Seu plano e uso de reuniões"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
              style={{ color: c.ink3 }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = c.card2)}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 space-y-4 p-6">
            {loading ? (
              <div className="flex h-40 items-center justify-center">
                <div
                  className="h-8 w-8 animate-spin rounded-full border-2 border-notura-primary border-t-transparent"
                />
              </div>
            ) : tab === "profile" ? (
              <>
                {/* Name */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider" style={{ color: c.ink3 }}>
                    Nome completo
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputCls}
                    style={{ background: c.inputBg, borderColor: c.inputBorder, color: c.ink }}
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider" style={{ color: c.ink3 }}>
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={data.email}
                    disabled
                    className={inputCls}
                    style={{ background: c.card2, borderColor: c.inputBorder, color: c.ink3, cursor: "not-allowed" }}
                  />
                  <p className="mt-1 text-xs" style={{ color: c.ink3 }}>O e-mail não pode ser alterado.</p>
                </div>

                {/* Company */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider" style={{ color: c.ink3 }}>
                    Empresa
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className={inputCls}
                    placeholder="Nome da sua empresa"
                    style={{ background: c.inputBg, borderColor: c.inputBorder, color: c.ink }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="mt-2 w-full rounded-xl py-3 text-sm font-bold text-white transition-colors disabled:opacity-60"
                  style={{ background: "#6851FF" }}
                  onMouseEnter={(e) => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = "#5740EE"; }}
                  onMouseLeave={(e) => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = "#6851FF"; }}
                >
                  {saving ? "Salvando..." : "Salvar alterações"}
                </button>
              </>
            ) : tab === "preferences" ? (
              <div className="space-y-3">
                {prefs.map((pref) => (
                  <div
                    key={pref.id}
                    className="flex items-center gap-3.5 rounded-xl p-4"
                    style={{ background: c.card2 }}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
                      style={{ background: "rgba(104,81,255,0.15)" }}
                    >
                      {pref.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium" style={{ color: c.ink }}>{pref.label}</p>
                      <p className="text-xs" style={{ color: c.ink3 }}>{pref.description}</p>
                    </div>
                    {/* Toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        setPrefs((ps) => ps.map((p) => {
                          if (p.id !== pref.id) return p;
                          const next = !p.enabled;
                          if (p.id === "darkMode") setTheme(next ? "dark" : "light");
                          return { ...p, enabled: next };
                        }));
                      }}
                      className="relative h-5 w-9 shrink-0 rounded-full transition-colors"
                      style={{ background: pref.enabled ? "#6851FF" : c.border }}
                    >
                      <span
                        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                        style={{ left: pref.enabled ? "calc(100% - 18px)" : "2px" }}
                      />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Plan info */}
                <div
                  className="rounded-xl p-5"
                  style={{ background: "rgba(104,81,255,0.08)", border: "1px solid rgba(104,81,255,0.2)" }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#6851FF" }}>
                        Plano atual
                      </p>
                      <p className="mt-1 text-2xl font-bold" style={{ color: c.ink }}>{planLabel}</p>
                    </div>
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
                      style={{ background: "rgba(104,81,255,0.15)" }}
                    >
                      {data.plan === "pro" ? "⚡" : data.plan === "team" ? "👥" : "✨"}
                    </div>
                  </div>
                </div>

                {/* Usage */}
                <div className="rounded-xl p-5" style={{ background: c.card2 }}>
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: c.ink2 }}>Reuniões este mês</span>
                    <span className="font-bold" style={{ color: c.ink }}>{data.meetingsUsed} / {data.monthlyLimit}</span>
                  </div>
                  <div
                    className="mt-3 overflow-hidden rounded-full"
                    style={{ height: 6, background: c.border }}
                  >
                    <div
                      style={{ width: `${pct}%`, height: "100%", background: "#6851FF", borderRadius: 999, transition: "width 0.6s" }}
                    />
                  </div>
                  <p className="mt-2 text-right text-xs" style={{ color: c.ink3 }}>
                    {data.monthlyLimit - data.meetingsUsed} reuniões restantes
                  </p>
                </div>

                {data.plan === "free" && (
                  <button
                    type="button"
                    onClick={() => { onClose(); onUpgradeClick(); }}
                    className="w-full rounded-xl py-3 text-sm font-bold text-white transition-colors"
                    style={{ background: "#6851FF" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#5740EE")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#6851FF")}
                  >
                    ⚡ Fazer upgrade para Pro
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
