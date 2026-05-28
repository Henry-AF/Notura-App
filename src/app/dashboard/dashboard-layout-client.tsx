"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  FolderKanban,
  LayoutGrid,
  LogOut,
  Menu,
  Plus,
  Settings,
  Users,
  Video,
  X,
} from "lucide-react";
import posthog from "posthog-js";
import { Logo, LogoFull } from "@/components/logo";
import { SidebarPlanWidget } from "@/components/dashboard/SidebarPlanWidget";
import { WhatsAppSupportButton } from "@/components/dashboard/WhatsAppSupportButton";
import { RecordingSessionProvider } from "@/components/recording";
import { PlanModal } from "@/components/settings/PlanModal";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getPlanTitle } from "@/lib/plans";
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
  badge?: string;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/dashboard/meetings", label: "Reuniões", icon: Video },
  { href: "/dashboard/groups", label: "Grupos", icon: FolderKanban },
  { href: "/dashboard/ai-chats", label: "Chats", icon: Bot, badge: "BETA" },
  // { href: "/dashboard/contacts", label: "Contatos", icon: Users },
];

function getPlanLabel(plan: CurrentUser["plan"]) {
  return getPlanTitle(plan);
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

function CreateButton({ onNavigate, collapsible }: { onNavigate?: () => void; collapsible?: boolean }) {
  return (
    <div className="mb-2 px-3">
      {collapsible && (
        <Link
          href="/dashboard/recording"
          onClick={onNavigate}
          className="flex w-full items-center justify-center rounded-xl bg-gradient-to-br from-notura-primary to-violet-500 p-2.5 text-white transition-all active:scale-[0.98] group-hover:hidden"
        >
          <Plus className="h-4 w-4" />
        </Link>
      )}
      <Link
        href="/dashboard/recording"
        onClick={onNavigate}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl bg-gradient-to-br from-notura-primary to-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98]",
          collapsible && "hidden group-hover:flex"
        )}
      >
        <Plus className="h-4 w-4" />
        Nova reunião
      </Link>
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
      posthog.capture("user_logged_out");
      posthog.reset();
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

function SidebarNavigation({ onNavigate, collapsible }: { onNavigate?: () => void; collapsible?: boolean }) {
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
              "flex items-center rounded-lg py-2.5 text-sm font-medium transition-all duration-150",
              collapsible
                ? cn(
                    "justify-center group-hover:justify-start group-hover:gap-3 group-hover:px-3",
                    active
                      ? "bg-notura-surface text-notura-ink group-hover:border-l-2 group-hover:border-notura-primary"
                      : "text-notura-ink-secondary hover:bg-notura-surface/50 hover:text-notura-ink"
                  )
                : cn(
                    "gap-3 px-3",
                    active
                      ? "border-l-2 border-notura-primary bg-notura-surface text-notura-ink"
                      : "text-notura-ink-secondary hover:bg-notura-surface/50 hover:text-notura-ink"
                  )
            )}
          >
            <Icon
              className={cn(
                "h-[18px] w-[18px] shrink-0",
                active && "text-notura-primary"
              )}
            />
            {collapsible ? (
              <span className="hidden whitespace-nowrap group-hover:flex group-hover:items-center group-hover:gap-1.5">
                {item.label}
                {item.badge ? (
                  <span className="rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-primary/15 text-primary">
                    {item.badge}
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                {item.label}
                {item.badge ? (
                  <span className="rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-primary/15 text-primary">
                    {item.badge}
                  </span>
                ) : null}
              </span>
            )}
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
  collapsible = false,
}: {
  user: CurrentUser;
  onUpgradeClick: () => void;
  onSettingsClick: () => void;
  collapsible?: boolean;
}) {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div
      className={cn(
        "space-y-3 pb-4 pt-3",
        collapsible ? "px-2 group-hover:px-4" : "px-4"
      )}
    >
      {collapsible ? (
        <>
          <div className="flex justify-center group-hover:hidden">
            <SidebarPlanWidget
              planName={getPlanLabel(user.plan)}
              used={user.meetingsThisMonth}
              total={user.monthlyLimit}
              variant="compact"
            />
          </div>
          <div className="hidden group-hover:block">
            <SidebarPlanWidget
              planName={getPlanLabel(user.plan)}
              used={user.meetingsThisMonth}
              total={user.monthlyLimit}
              onUpgradeClick={onUpgradeClick}
            />
          </div>
        </>
      ) : (
        <SidebarPlanWidget
          planName={getPlanLabel(user.plan)}
          used={user.meetingsThisMonth}
          total={user.monthlyLimit}
          onUpgradeClick={onUpgradeClick}
        />
      )}

      <div className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={showDropdown}
          onClick={() => setShowDropdown((value) => !value)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-notura-surface/50",
            collapsible && "justify-center group-hover:justify-start"
          )}
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback
              name={user.name}
              className="bg-notura-primary/20 text-xs text-notura-primary"
            >
              {getUserInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          {collapsible ? (
            <div className="hidden min-w-0 flex-1 text-left group-hover:block">
              <p className="truncate text-sm font-medium text-notura-ink">
                {user.name}
              </p>
              <p className="text-[11px] text-notura-ink-secondary capitalize">
                {getPlanLabel(user.plan)}
              </p>
            </div>
          ) : (
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium text-notura-ink">
                {user.name}
              </p>
              <p className="text-[11px] text-notura-ink-secondary capitalize">
                {getPlanLabel(user.plan)}
              </p>
            </div>
          )}
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
  collapsible = false,
}: {
  user: CurrentUser;
  onNavigate?: () => void;
  onUpgradeClick: () => void;
  onSettingsClick: () => void;
  collapsible?: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "py-6",
          collapsible
            ? "flex items-center justify-center group-hover:justify-start group-hover:px-5"
            : "px-5"
        )}
      >
        <Link href="/dashboard" onClick={onNavigate}>
          {collapsible ? (
            <>
              <span className="block group-hover:hidden">
                <Logo size={28} />
              </span>
              <span className="hidden group-hover:block">
                <LogoFull iconSize={28} />
              </span>
            </>
          ) : (
            <LogoFull iconSize={28} />
          )}
        </Link>
      </div>

      <CreateButton onNavigate={onNavigate} collapsible={collapsible} />
      <SidebarNavigation onNavigate={onNavigate} collapsible={collapsible} />
      <SidebarFooter
        user={user}
        onUpgradeClick={onUpgradeClick}
        onSettingsClick={onSettingsClick}
        collapsible={collapsible}
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
    <RecordingSessionProvider>
      <div className="fixed inset-0 flex overflow-hidden bg-notura-bg">
        <aside className="group hidden w-16 shrink-0 overflow-hidden border-r border-notura-border/50 bg-notura-bg-secondary transition-[width] duration-[250ms] ease-in-out hover:w-60 lg:block">
          <SidebarContent
            user={user}
            collapsible
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

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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

          <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
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

        <WhatsAppSupportButton />
      </div>
    </RecordingSessionProvider>
  );
}
