"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  CheckSquare,
  Settings,
  Plus,
  Menu,
  X,
} from "lucide-react";
import { LogoFull, Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Reuniões", icon: Calendar, exact: true },
  { href: "/dashboard/tasks", label: "Tarefas", icon: CheckSquare },
  { href: "/dashboard/settings", label: "Configurações", icon: Settings },
];

// Mock user — replace with real auth data
const mockUser = {
  name: "Henry Mano",
  plan: "pro" as const,
};

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="px-5 py-6">
        <Link href="/dashboard" onClick={onNavigate}>
          <LogoFull iconSize={28} />
        </Link>
      </div>

      {/* New Meeting CTA */}
      <div className="px-4 pb-2">
        <Button asChild size="md" className="w-full gap-2">
          <Link href="/dashboard/new" onClick={onNavigate}>
            <Plus className="h-4 w-4" />
            Nova Reunião
          </Link>
        </Button>
      </div>

      <Separator className="my-3" />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-notura-green-light text-notura-green"
                  : "text-notura-muted hover:bg-notura-surface hover:text-notura-ink"
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Separator className="my-3" />

      {/* User info */}
      <div className="flex items-center gap-3 px-5 pb-6 pt-2">
        <Avatar className="h-9 w-9">
          <AvatarFallback name={mockUser.name} className="text-xs">
            HM
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-notura-ink">
            {mockUser.name}
          </p>
          <Badge
            variant="completed"
            className="mt-0.5 text-[10px] uppercase tracking-wide"
          >
            {mockUser.plan}
          </Badge>
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

  return (
    <div className="flex h-screen overflow-hidden bg-notura-surface">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-notura-border bg-white lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r border-notura-border bg-white transition-transform duration-200 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="absolute right-3 top-5">
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1 text-notura-muted hover:bg-notura-surface hover:text-notura-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <SidebarContent onNavigate={() => setMobileOpen(false)} />
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center gap-3 border-b border-notura-border bg-white px-4 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-notura-muted hover:bg-notura-surface hover:text-notura-ink"
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
