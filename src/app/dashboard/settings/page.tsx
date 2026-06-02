"use client";

import React, { useCallback, useEffect, useReducer } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ProfileCard,
  SubscriptionCard,
  IntegrationsCard,
  PreferencesCard,
  DangerZone,
} from "@/components/settings";
import type { Integration, Preference } from "@/components/settings";
import { PlanModal } from "@/components/settings/PlanModal";
import { ToastProvider, useToast } from "@/components/upload/Toast";
import { getPlanTitle } from "@/lib/plans";
import { useTheme } from "@/lib/theme-context";
import { LoadingState, PageHeader } from "@/components/ui/app";
import {
  fetchCurrentUser,
  prewarmBillingCustomerInBackground,
  updateCurrentUser,
  updateBillingAutoRenew,
  verifySettingsPayment,
  type CurrentUser,
} from "./settings-api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysUntilEndOfMonth(): number {
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return Math.max(
    1,
    Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );
}

function getPlanName(plan: CurrentUser["plan"]): string {
  return getPlanTitle(plan);
}

function notifyUserUpdated() {
  window.dispatchEvent(new Event("notura:user-updated"));
}

function clearPaymentSearch(pathname: string) {
  window.history.replaceState(null, "", pathname);
}

type SettingsPageState = {
  loading: boolean;
  name: string;
  email: string;
  company: string;
  rawPlan: "free" | "pro" | "team";
  planName: string;
  meetingsUsed: number;
  meetingsTotal: number | null;
  currentPeriodEnd: string | null;
  autoRenewEnabled: boolean;
  renewalStatus: string;
  autoRenewSaving: boolean;
  showPlanModal: boolean;
  integrations: Integration[];
  preferences: Preference[];
};

type SettingsPageAction =
  | { type: "userApplied"; user: CurrentUser }
  | { type: "loadingChanged"; value: boolean }
  | { type: "themeSynced"; isDark: boolean }
  | { type: "preferenceChanged"; id: string; value: boolean }
  | { type: "autoRenewSavingChanged"; value: boolean }
  | {
      type: "autoRenewUpdated";
      autoRenewEnabled: boolean;
      currentPeriodEnd: string | null;
      renewalStatus: string;
    }
  | { type: "planModalChanged"; value: boolean };

function buildIntegrations(user: CurrentUser): Integration[] {
  return [
    {
      id: "whatsapp",
      name: "WhatsApp",
      icon: "💬",
      phone: user.whatsappNumber,
      status: user.whatsappNumber ? "connected" : "disconnected",
    },
  ];
}

function buildPreferences(isDark: boolean): Preference[] {
  return [
    {
      id: "resume_notifications",
      icon: "🔔",
      name: "Notificações de Resumo",
      description: "Receba relatórios após cada reunião",
      enabled: true,
    },
    {
      id: "dark_mode",
      icon: "🌙",
      name: "Modo Escuro",
      description: "Interface em tons profundos",
      enabled: isDark,
    },
  ];
}

function settingsPageReducer(
  state: SettingsPageState,
  action: SettingsPageAction
): SettingsPageState {
  switch (action.type) {
    case "userApplied":
      return {
        ...state,
        name: action.user.name,
        email: action.user.email,
        company: action.user.company,
        rawPlan: action.user.plan,
        planName: getPlanName(action.user.plan),
        meetingsUsed: action.user.meetingsThisMonth,
        meetingsTotal: action.user.monthlyLimit,
        currentPeriodEnd: action.user.currentPeriodEnd ?? null,
        autoRenewEnabled: action.user.autoRenewEnabled ?? true,
        renewalStatus: action.user.renewalStatus ?? "idle",
        integrations: buildIntegrations(action.user),
      };
    case "loadingChanged":
      return { ...state, loading: action.value };
    case "themeSynced":
      return {
        ...state,
        preferences: state.preferences.map((preference) =>
          preference.id === "dark_mode"
            ? { ...preference, enabled: action.isDark }
            : preference
        ),
      };
    case "preferenceChanged":
      return {
        ...state,
        preferences: state.preferences.map((preference) =>
          preference.id === action.id
            ? { ...preference, enabled: action.value }
            : preference
        ),
      };
    case "autoRenewSavingChanged":
      return { ...state, autoRenewSaving: action.value };
    case "autoRenewUpdated":
      return {
        ...state,
        autoRenewEnabled: action.autoRenewEnabled,
        currentPeriodEnd: action.currentPeriodEnd,
        renewalStatus: action.renewalStatus,
      };
    case "planModalChanged":
      return { ...state, showPlanModal: action.value };
  }
}

// ─── Inner page ───────────────────────────────────────────────────────────────

function SettingsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { show } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [state, dispatch] = useReducer(settingsPageReducer, {
    loading: true,
    name: "",
    email: "",
    company: "",
    rawPlan: "free",
    planName: getPlanTitle("free"),
    meetingsUsed: 0,
    meetingsTotal: 3,
    currentPeriodEnd: null,
    autoRenewEnabled: true,
    renewalStatus: "idle",
    autoRenewSaving: false,
    showPlanModal: false,
    integrations: [
      {
        id: "whatsapp",
        name: "WhatsApp",
        icon: "💬",
        phone: "",
        status: "disconnected",
      },
    ],
    preferences: buildPreferences(theme === "dark"),
  });
  const {
    loading,
    name,
    email,
    company,
    rawPlan,
    planName,
    meetingsUsed,
    meetingsTotal,
    currentPeriodEnd,
    autoRenewEnabled,
    renewalStatus,
    autoRenewSaving,
    showPlanModal,
    integrations,
    preferences,
  } = state;

  const applyUser = useCallback((user: CurrentUser) => {
    dispatch({ type: "userApplied", user });
  }, []);

  const loadUser = useCallback(async () => {
    try {
      const user = await fetchCurrentUser();
      applyUser(user);
    } catch {
      show("Erro ao carregar configurações.", "error");
    } finally {
      dispatch({ type: "loadingChanged", value: false });
    }
  }, [applyUser, show]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    prewarmBillingCustomerInBackground();
  }, []);

  useEffect(() => {
    const payment = searchParams.get("payment");
    const provider = searchParams.get("provider");
    const sessionId = searchParams.get("session_id");

    if (provider && provider !== "abacatepay" && provider !== "stripe") return;

    if (payment === "canceled") {
      show("Pagamento cancelado.", "warning");
      clearPaymentSearch(pathname);
      return;
    }

    if (payment !== "success") return;

    let cancelled = false;

    async function verifyPayment() {
      dispatch({ type: "loadingChanged", value: true });

      try {
        await verifySettingsPayment(sessionId);
        const user = await fetchCurrentUser();

        if (!cancelled) {
          applyUser(user);
          notifyUserUpdated();
          show("Plano atualizado com sucesso!", "success");
        }
      } catch {
        if (!cancelled) {
          show("Pagamento recebido, mas não foi possível confirmar o plano.", "error");
        }
      } finally {
        if (!cancelled) {
          dispatch({ type: "loadingChanged", value: false });
          clearPaymentSearch(pathname);
        }
      }
    }

    void verifyPayment();

    return () => {
      cancelled = true;
    };
  }, [applyUser, pathname, searchParams, show]);

  // Sync dark_mode pref with actual theme
  useEffect(() => {
    dispatch({ type: "themeSynced", isDark: theme === "dark" });
  }, [theme]);

  const handleProfileSave = useCallback(
    async (data: { name: string; company: string; email: string }) => {
      try {
        const user = await updateCurrentUser({
          name: data.name,
          company: data.company,
        });
        applyUser(user);
        notifyUserUpdated();
        prewarmBillingCustomerInBackground();
        show("Perfil atualizado.", "success");
      } catch {
        show("Erro ao salvar perfil.", "error");
      }
    },
    [applyUser, show]
  );

  const handleDisconnect = useCallback(
    async (id: string) => {
      if (id === "whatsapp") {
        try {
          const user = await updateCurrentUser({ whatsappNumber: null });
          applyUser(user);
          notifyUserUpdated();
        } catch {
          show("Erro ao desconectar integração.", "error");
          return;
        }
      }
      show("Integração desconectada.", "warning");
    },
    [applyUser, show]
  );

  const handleConnect = useCallback(
    async (id: string, phone: string) => {
      if (id === "whatsapp") {
        try {
          const user = await updateCurrentUser({ whatsappNumber: phone });
          applyUser(user);
          notifyUserUpdated();
          prewarmBillingCustomerInBackground();
        } catch {
          show("Erro ao conectar WhatsApp.", "error");
          return;
        }
      }
      show("WhatsApp conectado.", "success");
    },
    [applyUser, show]
  );

  const handleToggle = useCallback(
    (id: string, value: boolean) => {
      if (id === "dark_mode") {
        toggleTheme();
        return;
      }
      dispatch({ type: "preferenceChanged", id, value });
      show("Preferência atualizada.", "success");
    },
    [show, toggleTheme]
  );

  const handleAutoRenewChange = useCallback(
    async (enabled: boolean) => {
      dispatch({ type: "autoRenewSavingChanged", value: true });

      try {
        const status = await updateBillingAutoRenew(enabled);
        dispatch({
          type: "autoRenewUpdated",
          autoRenewEnabled: status.autoRenewEnabled,
          currentPeriodEnd: status.currentPeriodEnd,
          renewalStatus: status.renewalStatus,
        });
        notifyUserUpdated();
        show(
          status.autoRenewEnabled
            ? "Renovação automática ativada."
            : "Renovação automática desativada.",
          "success"
        );
      } catch {
        show("Erro ao atualizar renovação automática.", "error");
      } finally {
        dispatch({ type: "autoRenewSavingChanged", value: false });
      }
    },
    [show]
  );

  const handleDeleteAccount = useCallback(async () => {
    const res = await fetch("/api/user/account", { method: "DELETE" });
    if (!res.ok) {
      show("Erro ao excluir a conta. Tente novamente.", "error");
      return;
    }
    router.push("/");
  }, [router, show]);

  if (loading) {
    return <LoadingState label="Carregando configurações..." />;
  }

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Configurações" },
        ]}
        title="Configurações"
        description="Gerencie seu perfil, integrações, preferências e plano."
      />

      {/* 2-col grid */}
      <div className="mt-6 grid gap-4">
        {/* Row 1 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div
            style={{ animation: "cardFadeIn 0.3s ease-out both", animationDelay: "0ms" }}
          >
            <ProfileCard
              name={name}
              subtitle="Configure suas informações pessoais e de exibição."
              company={company}
              email={email}
              onSave={handleProfileSave}
            />
          </div>

          <div
            style={{ animation: "cardFadeIn 0.3s ease-out both", animationDelay: "60ms" }}
          >
            <SubscriptionCard
              plan={rawPlan}
              planName={planName}
              meetingsUsed={meetingsUsed}
              meetingsTotal={meetingsTotal}
              renewsInDays={getDaysUntilEndOfMonth()}
              currentPeriodEnd={currentPeriodEnd}
              autoRenewEnabled={autoRenewEnabled}
              renewalStatus={renewalStatus}
              autoRenewSaving={autoRenewSaving}
              onAutoRenewChange={handleAutoRenewChange}
              onChangePlan={() =>
                dispatch({ type: "planModalChanged", value: true })
              }
            />
          </div>
        </div>

        {/* Row 2 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div
            style={{ animation: "cardFadeIn 0.3s ease-out both", animationDelay: "120ms" }}
          >
            <IntegrationsCard
              integrations={integrations}
              onDisconnect={handleDisconnect}
              onConnect={handleConnect}
            />
          </div>

          <div
            style={{ animation: "cardFadeIn 0.3s ease-out both", animationDelay: "180ms" }}
          >
            <PreferencesCard
              preferences={preferences}
              onToggle={handleToggle}
            />
          </div>
        </div>

        {/* Row 3 – full width */}
        <div
          style={{ animation: "cardFadeIn 0.3s ease-out both", animationDelay: "240ms" }}
        >
          <DangerZone onDeleteAccount={handleDeleteAccount} />
        </div>
      </div>

      {/* Plan modal */}
      {showPlanModal && (
        <PlanModal
          currentPlan={rawPlan}
          onClose={() => dispatch({ type: "planModalChanged", value: false })}
          onSuccess={() => {
            void fetchCurrentUser()
              .then((user) => {
                applyUser(user);
                notifyUserUpdated();
              })
              .catch(() => {});
            show("Plano atualizado com sucesso!", "success");
          }}
        />
      )}

      <style>{`
        @keyframes cardFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <ToastProvider>
      <SettingsPageInner />
    </ToastProvider>
  );
}
