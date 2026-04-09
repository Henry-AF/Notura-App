"use client";

import React, { useState, useEffect, useRef } from "react";
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

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/dashboard/meetings", label: "Reuniões", icon: Video },
  // { href: "/dashboard/tasks", label: "Tarefas", icon: CheckSquare },
  { href: "/dashboard/contacts", label: "Contatos", icon: Users },
];

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
        className="flex w-full items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98]"
        style={{ background: "linear-gradient(135deg, #6C5CE7, #8B5CF6)" }}
      >
        <span className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Criar
        </span>
        <ChevronDown
          className="h-3.5 w-3.5 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {open && (
        <div
          className="absolute left-3 right-3 top-full mt-1.5 overflow-hidden rounded-xl border shadow-xl z-50"
          style={{
            background: "rgb(var(--cn-card))",
            borderColor: "rgb(var(--cn-border))",
            animation: "dropDown 0.15s cubic-bezier(0.25,0.46,0.45,0.94)",
          }}
        >
          <button
            type="button"
            onClick={() => go("/dashboard/recording")}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors"
            style={{ color: "rgb(var(--cn-ink2))" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgb(var(--cn-card2))")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
          >
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "rgba(108,92,231,0.15)" }}
            >
              <Mic className="h-3.5 w-3.5 text-[#6C5CE7]" />
            </div>
            <div className="text-left">
              <p className="font-medium" style={{ color: "rgb(var(--cn-ink))" }}>Nova reunião</p>
              <p className="text-xs" style={{ color: "rgb(var(--cn-muted))" }}>Gravar ou iniciar reunião</p>
            </div>
          </button>

          <div style={{ height: 1, background: "rgb(var(--cn-border))", margin: "0 12px" }} />

          <button
            type="button"
            onClick={() => go("/dashboard/new")}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors"
            style={{ color: "rgb(var(--cn-ink2))" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgb(var(--cn-card2))")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
          >
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "rgba(78,203,113,0.15)" }}
            >
              <UploadCloud className="h-3.5 w-3.5 text-[#4ECB71]" />
            </div>
            <div className="text-left">
              <p className="font-medium" style={{ color: "rgb(var(--cn-ink))" }}>Upload de arquivo</p>
              <p className="text-xs" style={{ color: "rgb(var(--cn-muted))" }}>Enviar áudio ou vídeo</p>
            </div>
          </button>
        </div>
      )}

      <style>{`
        @keyframes dropDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── User profile dropdown ────────────────────────────────────────────────────

function UserDropdown({
  user,
  onClose,
  onSettingsClick,
}: {
  user: { name: string; plan: string };
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
            {user.plan === "pro" ? "Plano Pro" : user.plan === "team" ? "Plano Team" : "Plano Gratuito"}
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
  onSettingsClick,
}: {
  onNavigate?: () => void;
  user: { name: string; plan: string };
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
                {user.plan === "pro" ? "Plano Pro" : user.plan === "team" ? "Plano Team" : "Plano Gratuito"}
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
  const [user, setUser] = useState({ name: "", plan: "free" });
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!authUser) return;
      Promise.all([
        supabase
          .from("profiles")
          .select("name")
          .eq("id", authUser.id)
          .single(),
        supabase
          .from("billing_accounts")
          .select("plan")
          .eq("user_id", authUser.id)
          .maybeSingle(),
      ]).then(([profileRes, billingRes]) => {
        setUser({
          name: profileRes.data?.name ?? authUser.email ?? "",
          plan: (billingRes.data?.plan ?? "free") as string,
        });
      });
    });
  }, []);

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
