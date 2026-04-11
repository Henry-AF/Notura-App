"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  Video,
  CheckSquare,
  Users,
  Mic,
  UploadCloud,
  Plus,
  Menu,
  X,
  LogOut,
  Settings,
  ChevronDown,
} from "lucide-react";
import { LogoFull, Logo } from "@/components/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { SidebarPlanWidget } from "@/components/dashboard/SidebarPlanWidget";
import { PlanModal } from "@/components/settings/PlanModal";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { ThemeProvider } from "@/lib/theme-context";
import { fetchCurrentUser } from "./settings/settings-api";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/dashboard/meetings", label: "Reuniões", icon: Video },
  // { href: "/dashboard/tasks", label: "Tarefas", icon: CheckSquare },
  { href: "/dashboard/contacts", label: "Contatos", icon: Users },
];

type DashboardShellUser = {
  name: string;
  plan: "free" | "pro" | "team";
  meetingsThisMonth: number;
  monthlyLimit: number | null;
};

function getPlanLabel(plan: DashboardShellUser["plan"]) {
  if (plan === "pro") return "Plano Pro";
  if (plan === "team") return "Plano Team";
  return "Plano Gratuito";
}

// ─── Criar dropdown ───────────────────────────────────────────────────────────

function CriarDropdown({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function go(href: string) {
    setOpen(false);
    onNavigate?.();
    router.push(href);
  }

  return (
    <div ref={ref} className="relative px-3 mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl bg-gradient-to-br from-notura-primary to-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98]"
      >
        <span className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Criar
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            open ? "rotate-180" : "rotate-0"
          )}
        />
      </button>

      {open && (
        <div
          className="absolute left-3 right-3 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-xl animate-slide-down"
        >
          <button
            type="button"
            onClick={() => go("/dashboard/recording")}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15">
              <Mic className="h-3.5 w-3.5 text-[#6C5CE7]" />
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground">Nova reunião</p>
              <p className="text-xs text-muted-foreground">Gravar ou iniciar reunião</p>
            </div>
          </button>

          <div className="mx-3 h-px bg-border" />

          <button
            type="button"
            onClick={() => go("/dashboard/new")}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
              <UploadCloud className="h-3.5 w-3.5 text-[#4ECB71]" />
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground">Upload de arquivo</p>
              <p className="text-xs text-muted-foreground">Enviar áudio ou vídeo</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── User profile dropdown ────────────────────────────────────────────────────

function UserDropdown({
  user,
  onClose,
  onSettingsClick,
}: {
  user: DashboardShellUser;
  onClose: () => void;
  onSettingsClick: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initials =
    user.name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U";

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 right-0 z-50 mb-1 rounded-xl border border-notura-border/50 bg-notura-bg-secondary p-1.5 shadow-xl animate-slide-up"
      role="menu"
    >
      {/* Profile header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback name={user.name} className="text-xs bg-notura-primary/20 text-notura-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-notura-ink">
            {user.name || "Usuário"}
          </p>
          <p className="text-[11px] text-notura-ink-secondary capitalize">
            {getPlanLabel(user.plan)}
          </p>
        </div>
      </div>

      <div className="my-1 border-t border-notura-border/40" />

      <button
        onClick={() => { onClose(); onSettingsClick(); }}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-notura-ink-secondary transition-colors hover:bg-notura-surface hover:text-notura-ink"
        role="menuitem"
      >
        <Settings className="h-3.5 w-3.5 shrink-0" />
        Configurações
      </button>

      <button
        onClick={handleLogout}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[rgba(255,107,107,0.1)] text-[#FF6B6B]"
        role="menuitem"
      >
        <LogOut className="h-3.5 w-3.5 shrink-0" />
        Sair
      </button>
    </div>
  );
}

// ─── Sidebar content ──────────────────────────────────────────────────────────

function SidebarContent({
  onNavigate,
  user,
  onUpgradeClick,
  onSettingsClick,
}: {
  onNavigate?: () => void;
  user: DashboardShellUser;
  onUpgradeClick: () => void;
  onSettingsClick: () => void;
}) {
  const pathname = usePathname();
  const [showDropdown, setShowDropdown] = useState(false);

  function isActive(item: (typeof navItems)[0]) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  const initials =
    user.name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U";

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="px-5 py-6">
        <Link href="/dashboard" onClick={onNavigate}>
          <LogoFull iconSize={28} />
        </Link>
      </div>

      {/* Criar CTA */}
      <CriarDropdown onNavigate={onNavigate} />

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-notura-surface text-notura-ink border-l-2 border-notura-primary"
                  : "text-notura-ink-secondary hover:bg-notura-surface/50 hover:text-notura-ink"
              )}
            >
              <Icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0",
                  active ? "text-notura-primary" : ""
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: plan widget + profile */}
      <div className="px-4 pb-4 pt-3 space-y-3">
        {/* Plan usage widget */}
        <SidebarPlanWidget
          planName={user.plan === "pro" ? "Plano Pro" : "Plano Gratuito"}
          used={3}
          total={user.plan === "pro" ? 30 : 3}
          onUpgradeClick={onUpgradeClick}
        />

        {/* User profile area — click to open dropdown */}
        <div className="relative">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-notura-surface/50"
            onClick={() => setShowDropdown((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={showDropdown}
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback name={user.name} className="text-xs bg-notura-primary/20 text-notura-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium text-notura-ink">
                {user.name || "Usuário"}
              </p>
              <p className="text-[11px] text-notura-ink-secondary capitalize">
                {getPlanLabel(user.plan)}
              </p>
            </div>
          </button>

          {showDropdown && (
            <UserDropdown
              user={user}
              onClose={() => setShowDropdown(false)}
              onSettingsClick={onSettingsClick}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<DashboardShellUser>({
    name: "",
    plan: "free",
    meetingsThisMonth: 0,
    monthlyLimit: 3,
  });
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const loadUser = useCallback(async () => {
    try {
      const currentUser = await fetchCurrentUser();
      setUser({
        name: currentUser.name || currentUser.email || "",
        plan: currentUser.plan,
        meetingsThisMonth: currentUser.meetingsThisMonth,
        monthlyLimit: currentUser.monthlyLimit,
      });
    } catch {
      // ignore sidebar refresh failures
    }
  }, []);

  useEffect(() => {
    void loadUser();

    const handleUserUpdated = () => void loadUser();
    const handleOpenPlanModal = () => setShowPlanModal(true);

    window.addEventListener("notura:user-updated", handleUserUpdated);
    window.addEventListener("notura:open-plan-modal", handleOpenPlanModal);
    return () => {
      window.removeEventListener("notura:user-updated", handleUserUpdated);
      window.removeEventListener("notura:open-plan-modal", handleOpenPlanModal);
    };
  }, [loadUser]);

  return (
    <ThemeProvider>
      <div className="flex h-screen overflow-hidden bg-notura-bg">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-notura-border/50 bg-notura-bg-secondary lg:block">
          <SidebarContent
            user={user}
            onUpgradeClick={() => setShowPlanModal(true)}
            onSettingsClick={() => setShowSettingsModal(true)}
          />
        </aside>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Mobile sidebar drawer */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-64 border-r border-notura-border/50 bg-notura-bg-secondary transition-transform duration-200 ease-in-out lg:hidden",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="absolute right-3 top-5">
            <button
              onClick={() => setMobileOpen(false)}
              className="rounded-md p-1 text-notura-ink-secondary hover:bg-notura-surface hover:text-notura-ink"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <SidebarContent
            user={user}
            onNavigate={() => setMobileOpen(false)}
            onUpgradeClick={() => {
              setMobileOpen(false);
              setShowPlanModal(true);
            }}
            onSettingsClick={() => {
              setMobileOpen(false);
              setShowSettingsModal(true);
            }}
          />
        </aside>

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile top bar */}
          <header className="flex h-14 items-center gap-3 border-b border-notura-border/50 bg-notura-bg-secondary px-4 lg:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-1.5 text-notura-ink-secondary hover:bg-notura-surface hover:text-notura-ink"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/dashboard">
              <Logo size={24} />
            </Link>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              {children}
            </div>
          </main>
        </div>

        {/* Global plan modal */}
        {showPlanModal && (
          <PlanModal
            currentPlan={user.plan}
            onClose={() => setShowPlanModal(false)}
          />
        )}

        {/* Global settings modal */}
        {showSettingsModal && (
          <SettingsModal
            onClose={() => setShowSettingsModal(false)}
            onUpgradeClick={() => {
              setShowSettingsModal(false);
              setShowPlanModal(true);
            }}
          />
        )}
      </div>
    </ThemeProvider>
  );
}
