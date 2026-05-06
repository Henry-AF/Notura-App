"use client";

import React, { useCallback, useEffect, useState } from "react";
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
  prewarmAbacatePayCustomerInBackground,
  updateCurrentUser,
  updateAbacatePayAutoRenew,
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

// ─── Inner page ───────────────────────────────────────────────────────────────

function SettingsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { show } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);

  // Profile fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [rawPlan, setRawPlan] = useState<"free" | "pro" | "team">("free");

  // Subscription fields
  const [planName, setPlanName] = useState(getPlanTitle("free"));
  const [meetingsUsed, setMeetingsUsed] = useState(0);
  const [meetingsTotal, setMeetingsTotal] = useState<number | null>(3);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [autoRenewEnabled, setAutoRenewEnabled] = useState(true);
  const [renewalStatus, setRenewalStatus] = useState("idle");
  const [autoRenewSaving, setAutoRenewSaving] = useState(false);

  // Modal
  const [showPlanModal, setShowPlanModal] = useState(false);

  // Integrations & preferences
  const [integrations, setIntegrations] = useState<Integration[]>([
    { id: "whatsapp", name: "WhatsApp", icon: "💬", phone: "", status: "disconnected" },
  ]);
  const [preferences, setPreferences] = useState<Preference[]>([
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
      enabled: theme === "dark",
    },
  ]);

  const applyUser = useCallback((user: CurrentUser) => {
    setName(user.name);
    setEmail(user.email);
    setCompany(user.company);
    setRawPlan(user.plan);
    setPlanName(getPlanName(user.plan));
    setMeetingsUsed(user.meetingsThisMonth);
    setMeetingsTotal(user.monthlyLimit);
    setCurrentPeriodEnd(user.currentPeriodEnd ?? null);
    setAutoRenewEnabled(user.abacatepayAutoRenewEnabled ?? true);
    setRenewalStatus(user.abacatepayRenewalStatus ?? "idle");
    setIntegrations([
      {
        id: "whatsapp",
        name: "WhatsApp",
        icon: "💬",
        phone: user.whatsappNumber,
        status: user.whatsappNumber ? "connected" : "disconnected",
      },
    ]);
  }, []);

  const loadUser = useCallback(async () => {
    try {
      const user = await fetchCurrentUser();
      applyUser(user);
    } catch {
      show("Erro ao carregar configurações.", "error");
    } finally {
      setLoading(false);
    }
  }, [applyUser, show]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    prewarmAbacatePayCustomerInBackground();
  }, []);

  useEffect(() => {
    const payment = searchParams.get("payment");
    const provider = searchParams.get("provider");

    if (provider !== "abacatepay") return;

    if (payment === "canceled") {
      show("Pagamento cancelado.", "warning");
      clearPaymentSearch(pathname);
      return;
    }

    if (payment !== "success") return;

    let cancelled = false;

    async function verifyPayment() {
      setLoading(true);

      try {
        await verifySettingsPayment();
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
          setLoading(false);
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
    setPreferences((prev) =>
      prev.map((p) => (p.id === "dark_mode" ? { ...p, enabled: theme === "dark" } : p))
    );
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
        prewarmAbacatePayCustomerInBackground();
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
          prewarmAbacatePayCustomerInBackground();
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
      setPreferences((prev) =>
        prev.map((p) => (p.id === id ? { ...p, enabled: value } : p))
      );
      show("Preferência atualizada.", "success");
    },
    [show, toggleTheme]
  );

  const handleAutoRenewChange = useCallback(
    async (enabled: boolean) => {
      setAutoRenewSaving(true);

      try {
        const status = await updateAbacatePayAutoRenew(enabled);
        setAutoRenewEnabled(status.autoRenewEnabled);
        setCurrentPeriodEnd(status.currentPeriodEnd);
        setRenewalStatus(status.renewalStatus);
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
        setAutoRenewSaving(false);
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
              onChangePlan={() => setShowPlanModal(true)}
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
          onClose={() => setShowPlanModal(false)}
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
