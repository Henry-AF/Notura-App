"use client";

import React, { useState } from "react";
import {
  UserPlus,
  Search,
  MoreVertical,
  Phone,
  Trash2,
  Pencil,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Calendar,
  Video,
  MessageSquare,
  FileText,
  Zap,
  Users,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/app";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  active: boolean;
  initials: string;
  color: string;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  isConnected: boolean;
  connectedAs?: string;
  available: boolean;
  category: "calendar" | "video" | "productivity" | "messaging";
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockContacts: Contact[] = [
  {
    id: "c1",
    name: "Fernanda Vieira",
    phone: "+55 (11) 9 8877-6655",
    email: "fernanda@vieira.adv.br",
    active: true,
    initials: "FV",
    color: "rgba(104,81,255,0.3)",
  },
  {
    id: "c2",
    name: "Marcos Andrade",
    phone: "+55 (11) 9 7766-5544",
    email: "marcos@empresa.com.br",
    active: true,
    initials: "MA",
    color: "rgba(34,197,94,0.3)",
  },
  {
    id: "c3",
    name: "Carla Mendes",
    phone: "+55 (21) 9 9988-7711",
    active: true,
    initials: "CM",
    color: "rgba(251,191,36,0.3)",
  },
  {
    id: "c4",
    name: "Rafael Costa",
    phone: "+55 (51) 9 8833-2211",
    email: "rafael@startup.io",
    active: false,
    initials: "RC",
    color: "rgba(239,68,68,0.3)",
  },
  {
    id: "c5",
    name: "Ana Paula Souza",
    phone: "+55 (31) 9 7744-3322",
    active: true,
    initials: "AS",
    color: "rgba(139,122,255,0.3)",
  },
];

const mockIntegrations: Integration[] = [
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Busca reuniões automaticamente do\nseu calendário Google.",
    icon: Calendar,
    isConnected: true,
    connectedAs: "henry@empresa.com",
    available: true,
    category: "calendar",
  },
  {
    id: "zoom",
    name: "Zoom",
    description: "Transcreve e resume suas reuniões\nZoom automaticamente.",
    icon: Video,
    isConnected: false,
    available: true,
    category: "video",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Envia resumos de reuniões para canais\nou membros do Slack.",
    icon: MessageSquare,
    isConnected: false,
    available: false,
    category: "messaging",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Exporta notas e tarefas para páginas\ndo seu workspace Notion.",
    icon: FileText,
    isConnected: false,
    available: false,
    category: "productivity",
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Conecte Notura a mais de 5.000\naplicativos via automações.",
    icon: Zap,
    isConnected: false,
    available: false,
    category: "productivity",
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    description: "Integração com reuniões do\nMicrosoft Teams.",
    icon: Users,
    isConnected: false,
    available: false,
    category: "video",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function IntegrationCard({ integration }: { integration: Integration }) {
  const [connected, setConnected] = useState(integration.isConnected);
  const Icon = integration.icon;

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 transition-all duration-200",
        connected
          ? "border-notura-primary/20 bg-notura-surface"
          : "border-notura-border/20 bg-notura-surface",
        !integration.available && "opacity-60"
      )}
    >
      {/* Header row */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Icon wrapper */}
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              connected ? "bg-notura-primary/15" : "bg-notura-surface-2"
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5",
                connected ? "text-notura-primary" : "text-notura-ink-secondary"
              )}
            />
          </div>

          <div className="min-w-0">
            <p className="font-manrope font-extrabold text-sm tracking-[-0.2px] text-notura-ink">
              {integration.name}
            </p>
            {connected && integration.connectedAs && (
              <p className="mt-0.5 truncate text-xs text-notura-ink-secondary">
                {integration.connectedAs}
              </p>
            )}
          </div>
        </div>

        {/* Status badge */}
        {connected ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-notura-success/15 px-2.5 py-1 text-xs font-medium text-notura-success">
            <span className="h-1.5 w-1.5 rounded-full bg-notura-success" />
            Conectado
          </span>
        ) : !integration.available ? (
          <span className="inline-flex shrink-0 items-center rounded-full bg-notura-surface-2 px-2.5 py-1 text-xs font-medium text-notura-ink-secondary">
            Em breve
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-notura-surface-2 px-2.5 py-1 text-xs font-medium text-notura-ink-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-notura-muted" />
            Desconectado
          </span>
        )}
      </div>

      {/* Description */}
      <p className="mb-5 text-sm leading-relaxed text-notura-ink-secondary">
        {integration.description.replace("\n", " ")}
      </p>

      {/* Action button */}
      {connected ? (
        <button
          onClick={() => setConnected(false)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-notura-border/40 bg-notura-surface-2 px-4 py-2 text-sm font-medium text-notura-ink-secondary transition-colors hover:bg-notura-processing/10 hover:text-notura-processing hover:border-notura-processing/30"
        >
          <XCircle className="h-4 w-4" />
          Desconectar
        </button>
      ) : integration.available ? (
        <button
          onClick={() => setConnected(true)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90"
          style={{
            background: "linear-gradient(135deg, #6851FF, #8B7AFF)",
            boxShadow:
              "0 10px 15px -3px rgba(104,81,255,0.2), 0 4px 6px -4px rgba(104,81,255,0.2)",
          }}
        >
          <ExternalLink className="h-4 w-4" />
          Conectar
        </button>
      ) : (
        <button
          disabled
          className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-full border border-notura-border/40 bg-notura-surface-2 px-4 py-2 text-sm font-medium text-notura-ink-secondary opacity-60"
        >
          Em breve
        </button>
      )}
    </div>
  );
}

// ─── Add Contact Modal ────────────────────────────────────────────────────────

function AddContactModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-notura-bg-secondary p-6 shadow-xl sm:rounded-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-manrope font-extrabold tracking-[-0.3px] text-notura-ink">
            Novo contato
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-notura-surface text-notura-ink-secondary transition-colors hover:bg-notura-surface-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-notura-ink-secondary">
              Nome *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Fernanda Vieira"
              className="w-full rounded-xl border border-notura-border/50 bg-notura-surface px-4 py-2.5 text-sm text-notura-ink placeholder-notura-ink-secondary/50 outline-none transition-all focus:border-notura-primary focus:ring-2 focus:ring-notura-primary/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-notura-ink-secondary">
              WhatsApp *
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-notura-ink-secondary" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+55 (11) 9 9999-9999"
                className="w-full rounded-xl border border-notura-border/50 bg-notura-surface py-2.5 pl-10 pr-4 text-sm text-notura-ink placeholder-notura-ink-secondary/50 outline-none transition-all focus:border-notura-primary focus:ring-2 focus:ring-notura-primary/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-notura-ink-secondary">
              E-mail{" "}
              <span className="font-normal text-notura-ink-secondary/60">(opcional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@empresa.com"
              className="w-full rounded-xl border border-notura-border/50 bg-notura-surface px-4 py-2.5 text-sm text-notura-ink placeholder-notura-ink-secondary/50 outline-none transition-all focus:border-notura-primary focus:ring-2 focus:ring-notura-primary/20"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-notura-border/40 py-2.5 text-sm font-medium text-notura-ink-secondary transition-colors hover:bg-notura-surface"
          >
            Cancelar
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-full py-2.5 text-sm font-medium text-white transition-all hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #6851FF, #8B7AFF)",
              boxShadow:
                "0 10px 15px -3px rgba(104,81,255,0.2), 0 4px 6px -4px rgba(104,81,255,0.2)",
            }}
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Contact Row ──────────────────────────────────────────────────────────────

function ContactRow({
  contact,
  onToggle,
  onDelete,
}: {
  contact: Contact;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="group relative flex items-center gap-4 rounded-xl border border-notura-border/20 bg-notura-surface px-4 py-3 transition-all duration-150 hover:border-notura-border/40 hover:bg-notura-surface-2">
      {/* Avatar */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-notura-ink"
        style={{ backgroundColor: contact.color }}
      >
        {contact.initials}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-notura-ink">
          {contact.name}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="flex items-center gap-1 text-xs text-notura-ink-secondary">
            <Phone className="h-3 w-3" />
            {contact.phone}
          </span>
          {contact.email && (
            <span className="hidden truncate text-xs text-notura-ink-secondary sm:block">
              {contact.email}
            </span>
          )}
        </div>
      </div>

      {/* Status toggle */}
      <button
        onClick={() => onToggle(contact.id)}
        className={cn(
          "hidden shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all sm:inline-flex",
          contact.active
            ? "bg-notura-success/15 text-notura-success hover:bg-notura-success/25"
            : "bg-notura-surface-2 text-notura-ink-secondary hover:bg-notura-muted/20"
        )}
      >
        {contact.active ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" /> Ativo
          </>
        ) : (
          <>
            <XCircle className="h-3.5 w-3.5" /> Inativo
          </>
        )}
      </button>

      {/* Mobile status dot */}
      <span
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-full sm:hidden",
          contact.active ? "bg-notura-success" : "bg-notura-muted"
        )}
      />

      {/* Menu */}
      <div className="relative shrink-0">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-notura-ink-secondary transition-colors hover:bg-notura-surface-2 hover:text-notura-ink"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-9 z-20 min-w-[140px] overflow-hidden rounded-xl border border-notura-border/30 bg-notura-bg-secondary py-1 shadow-lg">
              <button
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-notura-ink transition-colors hover:bg-notura-surface"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(contact.id);
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-notura-processing transition-colors hover:bg-notura-processing/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remover
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>(mockContacts);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"all" | "active" | "inactive">(
    "all"
  );

  const filtered = contacts.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search);
    const matchTab =
      selectedTab === "all" ||
      (selectedTab === "active" && c.active) ||
      (selectedTab === "inactive" && !c.active);
    return matchSearch && matchTab;
  });

  const activeCount = contacts.filter((c) => c.active).length;
  const inactiveCount = contacts.filter((c) => !c.active).length;

  const handleToggle = (id: string) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, active: !c.active } : c))
    );
  };

  const handleDelete = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <>
      <div className="space-y-10">
        {/* ── Page Header ──────────────────────────────────────────────────── */}
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Contatos" },
          ]}
          title="Contatos & Integrações"
          description="Gerencie os contatos que recebem resumos e conecte ferramentas externas."
          actions={
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-full px-4 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 sm:self-auto"
              style={{
                background: "linear-gradient(135deg, #6851FF, #8B7AFF)",
                boxShadow:
                  "0 10px 15px -3px rgba(104,81,255,0.2), 0 4px 6px -4px rgba(104,81,255,0.2)",
              }}
            >
              <UserPlus className="h-4 w-4" />
              Adicionar contato
            </button>
          }
        />

        {/* ── Contacts Section ─────────────────────────────────────────────── */}
        <section>
          {/* Section heading */}
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-notura-primary/15">
                <Phone className="h-4 w-4 text-notura-primary" />
              </div>
              <h2 className="font-manrope font-extrabold tracking-[-0.2px] text-notura-ink">
                Contatos WhatsApp
              </h2>
              <span className="inline-flex items-center rounded-full bg-notura-primary/15 px-2.5 py-0.5 text-xs font-medium text-notura-primary">
                {contacts.length}
              </span>
            </div>
          </div>

          {/* Search + filter bar */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-notura-ink-secondary" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou n\u00famero..."
                className="w-full rounded-xl border border-notura-border/40 bg-notura-surface py-2.5 pl-10 pr-4 text-sm text-notura-ink placeholder-notura-ink-secondary/60 outline-none transition-all focus:border-notura-primary focus:ring-2 focus:ring-notura-primary/20"
              />
            </div>

            {/* Filter tabs */}
            <div className="flex items-center rounded-xl border border-notura-border/30 bg-notura-surface p-1">
              {(
                [
                  { value: "all", label: `Todos (${contacts.length})` },
                  { value: "active", label: `Ativos (${activeCount})` },
                  { value: "inactive", label: `Inativos (${inactiveCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setSelectedTab(tab.value)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150",
                    selectedTab === tab.value
                      ? "bg-notura-surface-2 text-notura-ink shadow-sm"
                      : "text-notura-ink-secondary hover:text-notura-ink"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contact list */}
          {filtered.length > 0 ? (
            <div className="space-y-2">
              {filtered.map((contact) => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-notura-border/20 bg-notura-surface py-14">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-notura-surface-2">
                <Search className="h-5 w-5 text-notura-ink-secondary" />
              </div>
              <p className="text-sm font-medium text-notura-ink">
                Nenhum contato encontrado
              </p>
              <p className="mt-1 text-xs text-notura-ink-secondary">
                Tente outro termo ou{" "}
                <button
                  onClick={() => setShowModal(true)}
                  className="text-notura-primary underline-offset-2 hover:underline"
                >
                  adicione um contato
                </button>
              </p>
            </div>
          )}

          {/* Summary bar */}
          {contacts.length > 0 && (
            <div className="mt-3 flex items-center gap-4 px-1 text-xs text-notura-ink-secondary">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-notura-success" />
                {activeCount} ativo{activeCount !== 1 ? "s" : ""}
              </span>
              {inactiveCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-notura-muted" />
                  {inactiveCount} inativo{inactiveCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
        </section>

        {/* ── Integrations Section ──────────────────────────────────────────── */}
        <section>
          {/* Section heading */}
          <div className="mb-5 flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-notura-primary/15">
              <Zap className="h-4 w-4 text-notura-primary" />
            </div>
            <h2 className="font-manrope font-extrabold tracking-[-0.2px] text-notura-ink">
              Integrações
            </h2>
          </div>

          {/* Integration grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mockIntegrations.map((integration) => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>

          {/* Footer note */}
          <p className="mt-4 text-xs text-notura-ink-secondary">
            Integrações marcadas com{" "}
            <span className="inline-flex items-center rounded-full bg-notura-surface-2 px-2 py-0.5 text-[11px] font-medium text-notura-ink-secondary">
              Em breve
            </span>{" "}
            estarão disponíveis em breve. Ative as notificações para ser avisado.
          </p>
        </section>
      </div>

      {/* ── Add Contact Modal ──────────────────────────────────────────────── */}
      {showModal && <AddContactModal onClose={() => setShowModal(false)} />}
    </>
  );
}
