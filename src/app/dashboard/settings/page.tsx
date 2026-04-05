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
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/lib/theme-context";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLAN_LIMITS: Record<"free" | "pro" | "team", number> = {
  free: 3,
  pro: 30,
  team: 999,
};

function getDaysUntilEndOfMonth(): number {
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return Math.max(
    1,
    Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );
}

// ─── Inner page ───────────────────────────────────────────────────────────────

function SettingsPageInner() {
  const router = useRouter();
  const { show } = useToast();
  const { theme, toggleTheme } = useTheme();

  // Profile fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [rawPlan, setRawPlan] = useState<"free" | "pro" | "team">("free");

  // Subscription fields
  const [planName, setPlanName] = useState("Plano Gratuito");
  const [meetingsUsed, setMeetingsUsed] = useState(0);
  const [meetingsTotal, setMeetingsTotal] = useState(3);

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

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [profileRes, billingRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("name, company, role, whatsapp_number")
          .eq("id", user.id)
          .single(),
        supabase
          .from("billing_accounts")
          .select("plan, meetings_this_month")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      const profile = profileRes.data;
      const billing = billingRes.data;
      const resolvedPlan = (billing?.plan ?? "free") as "free" | "pro" | "team";

      setName(profile?.name ?? user.email?.split("@")[0] ?? "");
      setEmail(user.email ?? "");
      setCompany(profile?.company ?? "");
      setRawPlan(resolvedPlan);
      setPlanName(
        resolvedPlan === "pro"
          ? "Plano Pro"
          : resolvedPlan === "team"
          ? "Plano Team"
          : "Plano Gratuito"
      );
      setMeetingsUsed(billing?.meetings_this_month ?? 0);
      setMeetingsTotal(PLAN_LIMITS[resolvedPlan]);

      if (profile?.whatsapp_number) {
        setIntegrations([
          {
            id: "whatsapp",
            name: "WhatsApp",
            icon: "💬",
            phone: profile.whatsapp_number,
            status: "connected",
          },
        ]);
      }
    }
    load();
  }, []);

  // Sync dark_mode pref with actual theme
  useEffect(() => {
    setPreferences((prev) =>
      prev.map((p) => (p.id === "dark_mode" ? { ...p, enabled: theme === "dark" } : p))
    );
  }, [theme]);

  const handleProfileSave = useCallback(
    async (data: { name: string; company: string; email: string }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("profiles")
        .update({ name: data.name, company: data.company })
        .eq("id", user.id);
      if (error) {
        show("Erro ao salvar perfil.", "error");
      } else {
        setName(data.name);
        setCompany(data.company);
        show("Perfil atualizado.", "success");
      }
    },
    [show]
  );

  const handleDisconnect = useCallback(
    async (id: string) => {
      if (id === "whatsapp") {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("profiles")
            .update({ whatsapp_number: null })
            .eq("id", user.id);
        }
      }
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: "disconnected" as const, phone: "" } : i
        )
      );
      show("Integração desconectada.", "warning");
    },
    [show]
  );

  const handleConnect = useCallback(
    async (id: string, phone: string) => {
      if (id === "whatsapp") {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("profiles")
            .update({ whatsapp_number: phone })
            .eq("id", user.id);
        }
      }
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: "connected" as const, phone } : i
        )
      );
      show("WhatsApp conectado.", "success");
    },
    [show]
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

