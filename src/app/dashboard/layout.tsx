"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  Video,
  CheckSquare,
  Settings,
  UploadCloud,
  PlusCircle,
  Menu,
  X,
  Zap,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { LogoFull, Logo } from "@/components/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { SidebarPlanWidget } from "@/components/dashboard/SidebarPlanWidget";
import { PlanModal } from "@/components/settings/PlanModal";
import { ThemeProvider } from "@/lib/theme-context";
import { fetchCurrentUser } from "./settings/settings-api";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/dashboard/recording", label: "Nova Reunião", icon: PlusCircle },
  { href: "/dashboard/meetings", label: "Reuniões", icon: Video },
  { href: "/dashboard/tasks", label: "Tarefas", icon: CheckSquare },
  { href: "/dashboard/new", label: "Upload", icon: UploadCloud },
  { href: "/dashboard/settings", label: "Configurações", icon: Settings },
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

// ─── User profile dropdown ────────────────────────────────────────────────────

function UserDropdown({
  user,
  onClose,
}: {
  user: DashboardShellUser;
  onClose: () => void;
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

  async function handleSwitch() {
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
      className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-notura-border/50 bg-notura-bg-secondary p-1.5 shadow-xl z-50"
      style={{ animation: "dropUp 0.15s cubic-bezier(0.25,0.46,0.45,0.94)" }}
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
        onClick={handleSwitch}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-notura-ink-secondary transition-colors hover:bg-notura-surface hover:text-notura-ink"
        role="menuitem"
      >
        <RefreshCw className="h-3.5 w-3.5 shrink-0" />
        Trocar conta
      </button>

      <button
        onClick={handleLogout}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[rgba(255,107,107,0.1)] text-[#FF6B6B]"
        role="menuitem"
      >
        <LogOut className="h-3.5 w-3.5 shrink-0" />
        Sair
      </button>

      <style>{`
        @keyframes dropUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Sidebar content ──────────────────────────────────────────────────────────

function SidebarContent({
  onNavigate,
  user,
  onUpgradeClick,
}: {
  onNavigate?: () => void;
  user: DashboardShellUser;
  onUpgradeClick: () => void;
}) {
  const pathname = usePathname();
  const [showDropdown, setShowDropdown] = useState(false);

  function isActive(item: (typeof navItems)[0]) {
    if (item.exact) return pathname === item.href;
    if ((item as { matchPrefix?: string }).matchPrefix)
      return pathname.startsWith((item as { matchPrefix?: string }).matchPrefix!);
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

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={`${item.href}-${item.label}`}
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

      {/* Bottom: plan widget + upgrade nudge + profile */}
      <div className="px-4 pb-4 pt-3 space-y-3">
        {/* Plan usage widget */}
        <SidebarPlanWidget
          planName={getPlanLabel(user.plan)}
          used={user.meetingsThisMonth}
          total={user.monthlyLimit}
        />

        {/* Upgrade nudge */}
        {user.plan === "free" && (
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              onUpgradeClick();
            }}
            className="flex w-full items-center gap-2 rounded-lg bg-notura-primary/10 border border-notura-primary/30 px-3 py-2.5 text-xs font-medium text-notura-primary hover:bg-notura-primary/20 transition-colors"
          >
            <Zap className="h-3.5 w-3.5 shrink-0" />
            <span>Upgrade para ilimitado</span>
          </button>
        )}

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
            <UserDropdown user={user} onClose={() => setShowDropdown(false)} />
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

    const handleUserUpdated = () => {
      void loadUser();
    };

    window.addEventListener("notura:user-updated", handleUserUpdated);
    return () => {
      window.removeEventListener("notura:user-updated", handleUserUpdated);
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
      </div>
    </ThemeProvider>
  );
}
