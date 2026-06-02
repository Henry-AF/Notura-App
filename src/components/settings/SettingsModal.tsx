"use client";

import React, { useEffect, useReducer, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronRight,
  CreditCard,
  LogOut,
  Pencil,
  User,
  X,
} from "lucide-react";
import { AutoRenewControl } from "@/components/settings/AutoRenewControl";
import { updateBillingAutoRenew } from "@/lib/billing-auto-renew-client";
import { useTheme, useThemeColors } from "@/lib/theme-context";
import {
  logoutCurrentUser,
  updateCurrentUser,
} from "@/lib/user/current-user-client";
import { prewarmBillingCustomerInBackground } from "@/lib/billing-customer-client";
import { getPlanTitle } from "@/lib/plans";
import type { CurrentUser } from "@/lib/user/current-user-types";

interface UserData {
  name: string;
  email: string;
  company: string;
  plan: CurrentUser["plan"];
  meetingsUsed: number;
  monthlyLimit: number | null;
  currentPeriodEnd: string | null;
  autoRenewEnabled: boolean;
  renewalStatus: string;
}

type Tab = "profile" | "preferences" | "plan";

interface Pref {
  id: string;
  icon: string;
  label: string;
  description: string;
  enabled: boolean;
}

function buildUserData(user: CurrentUser): UserData {
  return {
    name: user.name,
    email: user.email,
    company: user.company,
    plan: user.plan,
    meetingsUsed: user.meetingsThisMonth,
    monthlyLimit: user.monthlyLimit,
    currentPeriodEnd: user.currentPeriodEnd ?? null,
    autoRenewEnabled: user.autoRenewEnabled ?? true,
    renewalStatus: user.renewalStatus ?? "idle",
  };
}

function buildPrefs(isDark: boolean): Pref[] {
  return [
    {
      id: "whatsapp",
      icon: "💬",
      label: "Resumo via WhatsApp",
      description: "Receba resumos das reuniões no WhatsApp",
      enabled: true,
    },
    {
      id: "email",
      icon: "📧",
      label: "Notificações por e-mail",
      description: "Avisos sobre tarefas e prazos",
      enabled: false,
    },
    {
      id: "darkMode",
      icon: "🌙",
      label: "Modo escuro",
      description: "Usar tema escuro no painel",
      enabled: isDark,
    },
  ];
}

type SettingsModalState = {
  tab: Tab;
  saving: boolean;
  autoRenewSaving: boolean;
  data: UserData;
  name: string;
  company: string;
  prefs: Pref[];
};

type SettingsModalAction =
  | { type: "tabChanged"; tab: Tab }
  | { type: "fieldChanged"; field: "name" | "company"; value: string }
  | { type: "currentUserChanged"; data: UserData }
  | { type: "darkModeSynced"; isDark: boolean }
  | { type: "preferenceToggled"; prefId: string }
  | { type: "savingChanged"; value: boolean }
  | { type: "profileSaved"; data: UserData }
  | { type: "autoRenewSavingChanged"; value: boolean }
  | {
      type: "autoRenewUpdated";
      currentPeriodEnd: string | null;
      autoRenewEnabled: boolean;
      renewalStatus: string;
    };

function createSettingsModalState({
  currentUser,
  isDark,
}: {
  currentUser: CurrentUser;
  isDark: boolean;
}): SettingsModalState {
  const data = buildUserData(currentUser);
  return {
    tab: "profile",
    saving: false,
    autoRenewSaving: false,
    data,
    name: data.name,
    company: data.company,
    prefs: buildPrefs(isDark),
  };
}

function settingsModalReducer(
  state: SettingsModalState,
  action: SettingsModalAction
): SettingsModalState {
  switch (action.type) {
    case "tabChanged":
      return { ...state, tab: action.tab };
    case "fieldChanged":
      return { ...state, [action.field]: action.value };
    case "currentUserChanged":
      return {
        ...state,
        data: action.data,
        name: action.data.name,
        company: action.data.company,
      };
    case "darkModeSynced":
      return {
        ...state,
        prefs: state.prefs.map((pref) =>
          pref.id === "darkMode" ? { ...pref, enabled: action.isDark } : pref
        ),
      };
    case "preferenceToggled":
      return {
        ...state,
        prefs: state.prefs.map((pref) =>
          pref.id === action.prefId ? { ...pref, enabled: !pref.enabled } : pref
        ),
      };
    case "savingChanged":
      return { ...state, saving: action.value };
    case "profileSaved":
      return {
        ...state,
        data: action.data,
        name: action.data.name,
        company: action.data.company,
      };
    case "autoRenewSavingChanged":
      return { ...state, autoRenewSaving: action.value };
    case "autoRenewUpdated":
      return {
        ...state,
        data: {
          ...state.data,
          currentPeriodEnd: action.currentPeriodEnd,
          autoRenewEnabled: action.autoRenewEnabled,
          renewalStatus: action.renewalStatus,
        },
      };
  }
}

export function SettingsModal({
  currentUser,
  onClose,
  onUpgradeClick,
  onUserChange,
}: {
  currentUser: CurrentUser;
  onClose: () => void;
  onUpgradeClick: () => void;
  onUserChange?: (user: CurrentUser) => void;
}) {
  const c = useThemeColors();
  const { isDark, setTheme } = useTheme();
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalFrameMinHeight = "min(560px, 90dvh)";

  const [state, dispatch] = useReducer(
    settingsModalReducer,
    { currentUser, isDark },
    createSettingsModalState
  );
  const { tab, saving, autoRenewSaving, data, name, company, prefs } = state;

  useEffect(() => {
    dispatch({ type: "currentUserChanged", data: buildUserData(currentUser) });
  }, [currentUser]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    dispatch({ type: "darkModeSynced", isDark });
  }, [isDark]);

  async function handleSaveProfile() {
    dispatch({ type: "savingChanged", value: true });

    try {
      const updatedUser = await updateCurrentUser({
        name: name.trim(),
        company: company.trim(),
      });
      const nextData = buildUserData(updatedUser);
      dispatch({ type: "profileSaved", data: nextData });
      onUserChange?.(updatedUser);
      prewarmBillingCustomerInBackground("settings");
    } finally {
      dispatch({ type: "savingChanged", value: false });
    }
  }

  async function handleLogout() {
    try {
      await logoutCurrentUser();
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("[settings-modal] logout failed", error);
    }
  }

  async function handleAutoRenewChange(enabled: boolean) {
    dispatch({ type: "autoRenewSavingChanged", value: true });

    try {
      const status = await updateBillingAutoRenew(enabled);
      dispatch({
        type: "autoRenewUpdated",
        currentPeriodEnd: status.currentPeriodEnd,
        autoRenewEnabled: status.autoRenewEnabled,
        renewalStatus: status.renewalStatus,
      });
      onUserChange?.({
        ...currentUser,
        currentPeriodEnd: status.currentPeriodEnd,
        autoRenewEnabled: status.autoRenewEnabled,
        renewalStatus: status.renewalStatus,
        abacatepayAutoRenewEnabled: status.autoRenewEnabled,
        abacatepayRenewalStatus: status.renewalStatus,
      });
    } catch (error) {
      console.error("[settings-modal] auto renew update failed", error);
    } finally {
      dispatch({ type: "autoRenewSavingChanged", value: false });
    }
  }

  const initials =
    data.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((value) => value[0])
      .join("")
      .toUpperCase() || "U";
  const planLabel = getPlanTitle(data.plan);
  const monthlyLimit = data.monthlyLimit ?? 0;
  const hasLimit = monthlyLimit > 0;
  const pct = hasLimit
    ? Math.min(100, Math.round((data.meetingsUsed / monthlyLimit) * 100))
    : 100;
  const inputCls =
    "w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors";

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: "Perfil", icon: <User className="size-4" /> },
    {
      id: "preferences",
      label: "Preferências",
      icon: <Bell className="size-4" />,
    },
    { id: "plan", label: "Plano", icon: <CreditCard className="size-4" /> },
  ];

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center"
      onClick={(event) => {
        if (event.target === overlayRef.current) {
          onClose();
        }
      }}
    >
      <div
        className="settings-modal-panel relative flex w-full flex-col overflow-hidden rounded-t-[28px] shadow-2xl sm:max-w-2xl sm:flex-row sm:rounded-2xl"
        style={{
          background: c.bg2,
          border: `1px solid ${c.border}`,
          maxHeight: "90dvh",
          minHeight: modalFrameMinHeight,
        }}
      >
        {/* ── Mobile: drag handle ───────────────────────────────────── */}
        <div
          className="mx-auto mb-1 mt-3 h-1 w-10 shrink-0 rounded-full sm:hidden"
          style={{ background: c.border }}
        />

        {/* ── Mobile: compact header (avatar + name + close) ─────────── */}
        <div className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-1 sm:hidden">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #3B2A7A, #7C3AED)" }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold" style={{ color: c.ink }}>
              {data.name}
            </p>
            <p className="text-xs" style={{ color: c.ink3 }}>
              {planLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg"
            style={{ color: c.ink3 }}
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ── Mobile: horizontal tab pills ──────────────────────────── */}
        <div
          className="flex shrink-0 gap-1 border-t px-2 pb-2 pt-2 sm:hidden"
          style={{ borderColor: c.border }}
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => dispatch({ type: "tabChanged", tab: item.id })}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors"
              style={{
                background: tab === item.id ? "rgba(104,81,255,0.12)" : "transparent",
                color: tab === item.id ? "#6851FF" : c.ink2,
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {/* ── Desktop: sidebar ──────────────────────────────────────── */}
        <div
          className="hidden w-56 shrink-0 flex-col sm:flex"
          style={{ background: c.card2, borderRight: `1px solid ${c.border}` }}
        >
          <div className="px-5 pb-5 pt-6">
            <div className="relative mx-auto mb-3 size-16">
              <div
                className="flex size-16 items-center justify-center rounded-full text-xl font-bold text-white"
                style={{ background: "linear-gradient(135deg, #3B2A7A, #7C3AED)" }}
              >
                {initials}
              </div>
              <button
                type="button"
                className="absolute bottom-0 right-0 flex size-6 items-center justify-center rounded-full text-white"
                style={{ background: "#6851FF" }}
              >
                <Pencil className="size-2.5" />
              </button>
            </div>
            <p className="text-center text-sm font-semibold" style={{ color: c.ink }}>
              {data.name}
            </p>
            <p className="mt-0.5 text-center text-xs" style={{ color: c.ink3 }}>
              {planLabel}
            </p>
          </div>

          <nav className="flex-1 space-y-0.5 px-3">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => dispatch({ type: "tabChanged", tab: item.id })}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
                style={{
                  background: tab === item.id ? "rgba(104,81,255,0.12)" : "transparent",
                  color: tab === item.id ? "#6851FF" : c.ink2,
                }}
              >
                {item.icon}
                {item.label}
                {tab === item.id && <ChevronRight className="ml-auto size-3.5" />}
              </button>
            ))}
          </nav>

          <div className="px-3 pb-5 pt-3">
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
              style={{ color: "#FF6B6B" }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = "rgba(255,107,107,0.1)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = "transparent";
              }}
            >
              <LogOut className="size-4" />
              Sair
            </button>
          </div>
        </div>

        {/* ── Content area ──────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {/* Desktop-only content header */}
          <div
            className="hidden shrink-0 items-center justify-between px-6 py-5 sm:flex"
            style={{ borderBottom: `1px solid ${c.border}` }}
          >
            <div>
              <h2 className="text-lg font-bold" style={{ color: c.ink }}>
                {tab === "profile"
                  ? "Dados pessoais"
                  : tab === "preferences"
                  ? "Preferências"
                  : "Plano atual"}
              </h2>
              <p className="mt-0.5 text-xs" style={{ color: c.ink3 }}>
                {tab === "profile"
                  ? "Edite suas informações de perfil"
                  : tab === "preferences"
                  ? "Gerencie suas notificações e preferências"
                  : "Seu plano e uso de reuniões"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-lg transition-colors"
              style={{ color: c.ink3 }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = c.card2;
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = "transparent";
              }}
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 space-y-4 p-4 sm:p-6">
            {tab === "profile" ? (
              <>
                <div>
                  <label
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wider"
                    style={{ color: c.ink3 }}
                  >
                    Nome completo
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) =>
                      dispatch({
                        type: "fieldChanged",
                        field: "name",
                        value: event.target.value,
                      })
                    }
                    className={inputCls}
                    style={{
                      background: c.inputBg,
                      borderColor: c.inputBorder,
                      color: c.ink,
                    }}
                  />
                </div>

                <div>
                  <label
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wider"
                    style={{ color: c.ink3 }}
                  >
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={data.email}
                    disabled
                    className={inputCls}
                    style={{
                      background: c.card2,
                      borderColor: c.inputBorder,
                      color: c.ink3,
                      cursor: "not-allowed",
                    }}
                  />
                  <p className="mt-1 text-xs" style={{ color: c.ink3 }}>
                    O e-mail não pode ser alterado.
                  </p>
                </div>

                <div>
                  <label
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wider"
                    style={{ color: c.ink3 }}
                  >
                    Empresa
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(event) =>
                      dispatch({
                        type: "fieldChanged",
                        field: "company",
                        value: event.target.value,
                      })
                    }
                    className={inputCls}
                    placeholder="Nome da sua empresa"
                    style={{
                      background: c.inputBg,
                      borderColor: c.inputBorder,
                      color: c.ink,
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void handleSaveProfile()}
                  disabled={saving}
                  className="mt-2 w-full rounded-xl py-3 text-sm font-bold text-white transition-colors disabled:opacity-60"
                  style={{ background: "#6851FF" }}
                  onMouseEnter={(event) => {
                    if (!saving) {
                      event.currentTarget.style.background = "#5740EE";
                    }
                  }}
                  onMouseLeave={(event) => {
                    if (!saving) {
                      event.currentTarget.style.background = "#6851FF";
                    }
                  }}
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
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-lg"
                      style={{ background: "rgba(104,81,255,0.15)" }}
                    >
                      {pref.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium" style={{ color: c.ink }}>
                        {pref.label}
                      </p>
                      <p className="text-xs" style={{ color: c.ink3 }}>
                        {pref.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (pref.id === "darkMode") {
                          setTheme(pref.enabled ? "light" : "dark");
                        }
                        dispatch({ type: "preferenceToggled", prefId: pref.id });
                      }}
                      className="relative h-5 w-9 shrink-0 rounded-full transition-colors"
                      style={{ background: pref.enabled ? "#6851FF" : c.border }}
                    >
                      <span
                        className="absolute top-0.5 size-4 rounded-full bg-white shadow transition-all"
                        style={{
                          left: pref.enabled ? "calc(100% - 18px)" : "2px",
                        }}
                      />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div
                  className="rounded-xl p-5"
                  style={{
                    background: "rgba(104,81,255,0.08)",
                    border: "1px solid rgba(104,81,255,0.2)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p
                        className="text-xs font-bold uppercase tracking-wider"
                        style={{ color: "#6851FF" }}
                      >
                        Plano atual
                      </p>
                      <p className="mt-1 text-2xl font-bold" style={{ color: c.ink }}>
                        {planLabel}
                      </p>
                    </div>
                    <div
                      className="flex size-12 items-center justify-center rounded-full text-2xl"
                      style={{ background: "rgba(104,81,255,0.15)" }}
                    >
                      {data.plan === "pro"
                        ? "⚡"
                        : data.plan === "team"
                        ? "👥"
                        : "✨"}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl p-5" style={{ background: c.card2 }}>
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: c.ink2 }}>Reuniões este mês</span>
                    <span className="font-bold" style={{ color: c.ink }}>
                      {hasLimit
                        ? `${data.meetingsUsed} / ${monthlyLimit}`
                        : "Limite personalizado"}
                    </span>
                  </div>
                  <div
                    className="mt-3 overflow-hidden rounded-full"
                    style={{ height: 6, background: c.border }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: "#6851FF",
                        borderRadius: 999,
                        transition: "width 0.6s",
                      }}
                    />
                  </div>
                  <p className="mt-2 text-right text-xs" style={{ color: c.ink3 }}>
                    {hasLimit
                      ? `${Math.max(0, monthlyLimit - data.meetingsUsed)} reuniões restantes`
                      : "Limite personalizado no plano atual"}
                  </p>
                </div>

                <AutoRenewControl
                  plan={data.plan}
                  currentPeriodEnd={data.currentPeriodEnd}
                  autoRenewEnabled={data.autoRenewEnabled}
                  renewalStatus={data.renewalStatus}
                  pending={autoRenewSaving}
                  onChange={(enabled) => void handleAutoRenewChange(enabled)}
                />

                {data.plan === "free" && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onUpgradeClick();
                    }}
                    className="w-full rounded-xl py-3 text-sm font-bold text-white transition-colors"
                    style={{ background: "#6851FF" }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = "#5740EE";
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = "#6851FF";
                    }}
                  >
                    ⚡ Fazer upgrade para Pro
                  </button>
                )}
              </>
            )}
          </div>

          {/* Mobile-only logout at the bottom of the sheet */}
          <div
            className="shrink-0 border-t p-3 sm:hidden"
            style={{ borderColor: c.border }}
          >
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium"
              style={{ color: "#FF6B6B", background: "rgba(255,107,107,0.06)" }}
            >
              <LogOut className="size-4" />
              Sair da conta
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes settingsModalSlideUp {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes settingsModalScaleIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .settings-modal-panel {
          animation: settingsModalSlideUp 0.3s cubic-bezier(0.3, 0, 0.1, 1);
        }
        @media (min-width: 640px) {
          .settings-modal-panel {
            animation: settingsModalScaleIn 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          }
        }
      `}</style>
    </div>
  );
}
