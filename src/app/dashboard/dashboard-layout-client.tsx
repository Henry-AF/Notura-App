"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ChevronDown,
  LayoutGrid,
  LogOut,
  Menu,
  Mic,
  Plus,
  Settings,
  UploadCloud,
  Users,
  Video,
  X,
} from "lucide-react";
import { Logo, LogoFull } from "@/components/logo";
import { SidebarPlanWidget } from "@/components/dashboard/SidebarPlanWidget";
import { PlanModal } from "@/components/settings/PlanModal";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  fetchCurrentUser,
  logoutCurrentUser,
} from "@/lib/user/current-user-client";
import type { CurrentUser } from "@/lib/user/current-user-types";

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  initialUser: CurrentUser;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/dashboard/meetings", label: "Reuniões", icon: Video },
  { href: "/dashboard/contacts", label: "Contatos", icon: Users },
];

function getPlanLabel(plan: CurrentUser["plan"]) {
  if (plan === "team") return "Plano Team";
  if (plan === "pro") return "Plano Pro";
  return "Plano Gratuito";
}

function getUserInitials(name: string) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((value) => value[0])
    .join("")
    .toUpperCase();

  return initials || "U";
}

function useDismissibleLayer(
  open: boolean,
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void
) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, ref]);
}

function CreateDropdown({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useDismissibleLayer(open, ref, () => setOpen(false));

  function handleNavigate(href: string) {
    setOpen(false);
    onNavigate?.();
    router.push(href);
  }

  return (
    <div ref={ref} className="relative mb-2 px-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
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
        <div className="animate-slide-down absolute left-3 right-3 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          <button
            type="button"
            onClick={() => handleNavigate("/dashboard/recording")}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15">
              <Mic className="h-3.5 w-3.5 text-[#6C5CE7]" />
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground">Nova reunião</p>
              <p className="text-xs text-muted-foreground">
                Gravar ou iniciar reunião
              </p>
            </div>
          </button>

          <div className="mx-3 h-px bg-border" />

          <button
            type="button"
            onClick={() => handleNavigate("/dashboard/new")}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
              <UploadCloud className="h-3.5 w-3.5 text-[#4ECB71]" />
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground">Upload de arquivo</p>
              <p className="text-xs text-muted-foreground">
                Enviar áudio ou vídeo
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

function UserDropdown({
  user,
  onClose,
  onSettingsClick,
}: {
  user: CurrentUser;
  onClose: () => void;
  onSettingsClick: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useDismissibleLayer(true, ref, onClose);

  const handleLogout = useCallback(async () => {
    try {
      await logoutCurrentUser();
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("[dashboard] logout failed", error);
    } finally {
      onClose();
    }
  }, [onClose, router]);

  return (
    <div
      ref={ref}
      role="menu"
      className="animate-slide-up absolute bottom-full left-0 right-0 z-50 mb-1 rounded-xl border border-notura-border/50 bg-notura-bg-secondary p-1.5 shadow-xl"
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback
            name={user.name}
            className="bg-notura-primary/20 text-xs text-notura-primary"
          >
            {getUserInitials(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-notura-ink">
            {user.name}
          </p>
          <p className="text-[11px] text-notura-ink-secondary capitalize">
            {getPlanLabel(user.plan)}
          </p>
        </div>
      </div>

      <div className="my-1 border-t border-notura-border/40" />

      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          onSettingsClick();
        }}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-notura-ink-secondary transition-colors hover:bg-notura-surface hover:text-notura-ink"
      >
        <Settings className="h-3.5 w-3.5 shrink-0" />
        Configurações
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => void handleLogout()}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#FF6B6B] transition-colors hover:bg-[rgba(255,107,107,0.1)]"
      >
        <LogOut className="h-3.5 w-3.5 shrink-0" />
        Sair
      </button>
    </div>
  );
}

function SidebarNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-0.5 px-3">
      {navItems.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
              active
                ? "border-l-2 border-notura-primary bg-notura-surface text-notura-ink"
                : "text-notura-ink-secondary hover:bg-notura-surface/50 hover:text-notura-ink"
            )}
          >
            <Icon
              className={cn(
                "h-[18px] w-[18px] shrink-0",
                active && "text-notura-primary"
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({
  user,
  onUpgradeClick,
  onSettingsClick,
}: {
  user: CurrentUser;
  onUpgradeClick: () => void;
  onSettingsClick: () => void;
}) {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div className="space-y-3 px-4 pb-4 pt-3">
      <SidebarPlanWidget
        planName={getPlanLabel(user.plan)}
        used={user.meetingsThisMonth}
        total={user.monthlyLimit}
        onUpgradeClick={onUpgradeClick}
      />

      <div className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={showDropdown}
          onClick={() => setShowDropdown((value) => !value)}
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-notura-surface/50"
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback
              name={user.name}
              className="bg-notura-primary/20 text-xs text-notura-primary"
            >
              {getUserInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-medium text-notura-ink">
              {user.name}
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
  );
}

function SidebarContent({
  user,
  onNavigate,
  onUpgradeClick,
  onSettingsClick,
}: {
  user: CurrentUser;
  onNavigate?: () => void;
  onUpgradeClick: () => void;
  onSettingsClick: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-6">
        <Link href="/dashboard" onClick={onNavigate}>
          <LogoFull iconSize={28} />
        </Link>
      </div>

      <CreateDropdown onNavigate={onNavigate} />
      <SidebarNavigation onNavigate={onNavigate} />
      <SidebarFooter
        user={user}
        onUpgradeClick={onUpgradeClick}
        onSettingsClick={onSettingsClick}
      />
    </div>
  );
}

function MobileSidebar({
  open,
  user,
  onClose,
  onUpgradeClick,
  onSettingsClick,
}: {
  open: boolean;
  user: CurrentUser;
  onClose: () => void;
  onUpgradeClick: () => void;
  onSettingsClick: () => void;
}) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r border-notura-border/50 bg-notura-bg-secondary transition-transform duration-200 ease-in-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="absolute right-3 top-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-notura-ink-secondary hover:bg-notura-surface hover:text-notura-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <SidebarContent
          user={user}
          onNavigate={onClose}
          onUpgradeClick={onUpgradeClick}
          onSettingsClick={onSettingsClick}
        />
      </aside>
    </>
  );
}

export function DashboardLayoutClient({
  children,
  initialUser,
}: DashboardLayoutClientProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [user, setUser] = useState(initialUser);

  const refreshUser = useCallback(async () => {
    try {
      setUser(await fetchCurrentUser());
    } catch {
      // ignore sidebar refresh failures
    }
  }, []);

  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  useEffect(() => {
    const handleUserUpdated = () => void refreshUser();
    const handleOpenPlanModal = () => setShowPlanModal(true);

    window.addEventListener("notura:user-updated", handleUserUpdated);
    window.addEventListener("notura:open-plan-modal", handleOpenPlanModal);
    return () => {
      window.removeEventListener("notura:user-updated", handleUserUpdated);
      window.removeEventListener("notura:open-plan-modal", handleOpenPlanModal);
    };
  }, [refreshUser]);

  return (
    <div className="flex h-screen overflow-hidden bg-notura-bg">
      <aside className="hidden w-60 shrink-0 border-r border-notura-border/50 bg-notura-bg-secondary lg:block">
        <SidebarContent
          user={user}
          onUpgradeClick={() => setShowPlanModal(true)}
          onSettingsClick={() => setShowSettingsModal(true)}
        />
      </aside>

      <MobileSidebar
        open={mobileOpen}
        user={user}
        onClose={() => setMobileOpen(false)}
        onUpgradeClick={() => {
          setMobileOpen(false);
          setShowPlanModal(true);
        }}
        onSettingsClick={() => {
          setMobileOpen(false);
          setShowSettingsModal(true);
        }}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-3 border-b border-notura-border/50 bg-notura-bg-secondary px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-notura-ink-secondary hover:bg-notura-surface hover:text-notura-ink"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard">
            <Logo size={24} />
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      {showPlanModal && (
        <PlanModal
          currentPlan={user.plan}
          onClose={() => setShowPlanModal(false)}
          onSuccess={() => void refreshUser()}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          currentUser={user}
          onClose={() => setShowSettingsModal(false)}
          onUpgradeClick={() => {
            setShowSettingsModal(false);
            setShowPlanModal(true);
          }}
          onUserChange={setUser}
        />
      )}
    </div>
  );
}
