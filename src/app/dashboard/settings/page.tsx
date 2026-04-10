"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { useTheme } from "@/lib/theme-context";
import { LoadingState } from "@/components/ui/app";
import {
  fetchCurrentUser,
  updateCurrentUser,
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
  if (plan === "pro") return "Plano Pro";
  if (plan === "team") return "Plano Team";
  return "Plano Gratuito";
}

function notifyUserUpdated() {
  window.dispatchEvent(new Event("notura:user-updated"));
}

// ─── Inner page ───────────────────────────────────────────────────────────────

function SettingsPageInner() {
  const router = useRouter();
  const { show } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);

  // Profile fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [rawPlan, setRawPlan] = useState<"free" | "pro" | "team">("free");

  // Subscription fields
  const [planName, setPlanName] = useState("Plano Gratuito");
  const [meetingsUsed, setMeetingsUsed] = useState(0);
  const [meetingsTotal, setMeetingsTotal] = useState<number | null>(3);

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
      {/* Page title */}
      <h1 className="font-display text-[22px] font-bold text-notura-ink">
        Configurações
      </h1>

      {/* 2-col grid */}
      <div className="mt-6 grid gap-4" style={{ gridTemplateColumns: "1fr" }}>
        {/* Row 1 */}
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}
        >
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
              planName={planName}
              meetingsUsed={meetingsUsed}
              meetingsTotal={meetingsTotal}
              renewsInDays={getDaysUntilEndOfMonth()}
              onChangePlan={() => setShowPlanModal(true)}
            />
          </div>
        </div>

        {/* Row 2 */}
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}
        >
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
