"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { LogoFull, Logo } from "@/components/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { SidebarPlanWidget } from "@/components/dashboard/SidebarPlanWidget";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/dashboard/recording", label: "Nova Reunião", icon: PlusCircle },
  { href: "/dashboard", label: "Reuniões", icon: Video, matchPrefix: "/dashboard/meetings" },
  { href: "/dashboard/tasks", label: "Tarefas", icon: CheckSquare },
  { href: "/dashboard/new", label: "Upload", icon: UploadCloud },
  { href: "/dashboard/settings", label: "Configurações", icon: Settings },
];

function SidebarContent({
  onNavigate,
  user,
}: {
  onNavigate?: () => void;
  user: { name: string; plan: string };
}) {
  const pathname = usePathname();

  function isActive(item: (typeof navItems)[0]) {
    if (item.exact) return pathname === item.href;
    if (item.matchPrefix) return pathname.startsWith(item.matchPrefix);
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
                  ? "bg-notura-surface text-white border-l-2 border-notura-primary"
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
          planName={user.plan === "pro" ? "Plano Pro" : "Plano Gratuito"}
          used={3}
          total={10}
        />

        {/* Upgrade nudge */}
        {user.plan === "free" && (
          <Link
            href="/dashboard/settings"
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-lg bg-notura-primary/10 border border-notura-primary/30 px-3 py-2.5 text-xs font-medium text-notura-primary hover:bg-notura-primary/20 transition-colors"
          >
            <Zap className="h-3.5 w-3.5 shrink-0" />
            <span>Upgrade para ilimitado</span>
          </Link>
        )}

        {/* User profile */}
        <div className="flex items-center gap-3 px-1">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback name={user.name} className="text-xs bg-notura-primary/20 text-notura-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-notura-ink">
              {user.name || "Usuário"}
            </p>
            <p className="text-[11px] text-notura-ink-secondary capitalize">
              {user.plan === "pro" ? "Plano Pro" : "Plano Gratuito"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState({ name: "", plan: "free" });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!authUser) return;
      supabase
        .from("profiles")
        .select("name, plan")
        .eq("id", authUser.id)
        .single()
        .then(({ data: profile }) => {
          setUser({
            name: profile?.name ?? authUser.email ?? "",
            plan: (profile as any)?.plan ?? "free",
          });
        });
    });
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-notura-bg">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-notura-border/50 bg-notura-bg-secondary lg:block">
        <SidebarContent user={user} />
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
        <SidebarContent user={user} onNavigate={() => setMobileOpen(false)} />
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
    </div>
  );
}
