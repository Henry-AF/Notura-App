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
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

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
    color: "#e1e0ff",
  },
  {
    id: "c2",
    name: "Marcos Andrade",
    phone: "+55 (11) 9 7766-5544",
    email: "marcos@empresa.com.br",
    active: true,
    initials: "MA",
    color: "#d1fae5",
  },
  {
    id: "c3",
    name: "Carla Mendes",
    phone: "+55 (21) 9 9988-7711",
    active: true,
    initials: "CM",
    color: "#fef3c7",
  },
  {
    id: "c4",
    name: "Rafael Costa",
    phone: "+55 (51) 9 8833-2211",
    email: "rafael@startup.io",
    active: false,
    initials: "RC",
    color: "#fee2e2",
  },
  {
    id: "c5",
    name: "Ana Paula Souza",
    phone: "+55 (31) 9 7744-3322",
    active: true,
    initials: "AS",
    color: "#ede9fe",
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
          ? "border-[rgba(70,72,212,0.2)] bg-[#f6f3f2]"
          : "border-[rgba(199,196,215,0.2)] bg-[#f6f3f2]",
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
              connected ? "bg-[#e1e0ff]" : "bg-[#e5e2e1]"
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5",
                connected ? "text-[#4648d4]" : "text-[#464554]"
              )}
            />
          </div>

          <div className="min-w-0">
            <p className="font-manrope font-extrabold text-sm tracking-[-0.2px] text-[#1c1b1b]">
              {integration.name}
            </p>
            {connected && integration.connectedAs && (
              <p className="mt-0.5 truncate text-xs text-[#464554]">
                {integration.connectedAs}
              </p>
            )}
          </div>
        </div>

        {/* Status badge */}
        {connected ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Conectado
          </span>
        ) : !integration.available ? (
          <span className="inline-flex shrink-0 items-center rounded-full bg-[#e5e2e1] px-2.5 py-1 text-xs font-medium text-[#464554]">
            Em breve
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#e5e2e1] px-2.5 py-1 text-xs font-medium text-[#464554]">
            <span className="h-1.5 w-1.5 rounded-full bg-[rgba(199,196,215,0.8)]" />
            Desconectado
          </span>
        )}
      </div>

      {/* Description */}
      <p className="mb-5 text-sm leading-relaxed text-[#464554]">
        {integration.description.replace("\n", " ")}
      </p>

      {/* Action button */}
      {connected ? (
        <button
          onClick={() => setConnected(false)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[rgba(199,196,215,0.4)] bg-white px-4 py-2 text-sm font-medium text-[#464554] transition-colors hover:bg-red-50 hover:text-red-600 hover:border-red-200"
        >
          <XCircle className="h-4 w-4" />
          Desconectar
        </button>
      ) : integration.available ? (
        <button
          onClick={() => setConnected(true)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90"
          style={{
            background: "linear-gradient(135deg, #4648d4, #6063ee)",
            boxShadow:
              "0 10px 15px -3px rgba(70,72,212,0.2), 0 4px 6px -4px rgba(70,72,212,0.2)",
          }}
        >
          <ExternalLink className="h-4 w-4" />
          Conectar
        </button>
      ) : (
        <button
          disabled
          className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-full border border-[rgba(199,196,215,0.4)] bg-[#e5e2e1] px-4 py-2 text-sm font-medium text-[#464554] opacity-60"
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
      <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-manrope font-extrabold tracking-[-0.3px] text-[#1c1b1b]">
            Novo contato
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e5e2e1] text-[#464554] transition-colors hover:bg-[#d9d5d3]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#464554]">
              Nome *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Fernanda Vieira"
              className="w-full rounded-xl border border-[rgba(199,196,215,0.5)] bg-[#f6f3f2] px-4 py-2.5 text-sm text-[#1c1b1b] placeholder-[#464554]/50 outline-none transition-all focus:border-[#4648d4] focus:ring-2 focus:ring-[#4648d4]/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#464554]">
              WhatsApp *
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#464554]" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+55 (11) 9 9999-9999"
                className="w-full rounded-xl border border-[rgba(199,196,215,0.5)] bg-[#f6f3f2] py-2.5 pl-10 pr-4 text-sm text-[#1c1b1b] placeholder-[#464554]/50 outline-none transition-all focus:border-[#4648d4] focus:ring-2 focus:ring-[#4648d4]/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#464554]">
              E-mail{" "}
              <span className="font-normal text-[#464554]/60">(opcional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@empresa.com"
              className="w-full rounded-xl border border-[rgba(199,196,215,0.5)] bg-[#f6f3f2] px-4 py-2.5 text-sm text-[#1c1b1b] placeholder-[#464554]/50 outline-none transition-all focus:border-[#4648d4] focus:ring-2 focus:ring-[#4648d4]/20"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-[rgba(199,196,215,0.4)] py-2.5 text-sm font-medium text-[#464554] transition-colors hover:bg-[#f6f3f2]"
          >
            Cancelar
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-full py-2.5 text-sm font-medium text-white transition-all hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #4648d4, #6063ee)",
              boxShadow:
                "0 10px 15px -3px rgba(70,72,212,0.2), 0 4px 6px -4px rgba(70,72,212,0.2)",
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
    <div className="group relative flex items-center gap-4 rounded-xl border border-[rgba(199,196,215,0.2)] bg-white px-4 py-3 transition-all duration-150 hover:border-[rgba(199,196,215,0.5)] hover:shadow-sm">
      {/* Avatar */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-[#07006c]"
        style={{ backgroundColor: contact.color }}
      >
        {contact.initials}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#1c1b1b]">
          {contact.name}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="flex items-center gap-1 text-xs text-[#464554]">
            <Phone className="h-3 w-3" />
            {contact.phone}
          </span>
          {contact.email && (
            <span className="hidden truncate text-xs text-[#464554] sm:block">
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
            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "bg-[#e5e2e1] text-[#464554] hover:bg-[#d9d5d3]"
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
          contact.active ? "bg-emerald-500" : "bg-[rgba(199,196,215,0.8)]"
        )}
      />

      {/* Menu */}
      <div className="relative shrink-0">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[#464554] transition-colors hover:bg-[#f6f3f2] hover:text-[#1c1b1b]"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-9 z-20 min-w-[140px] overflow-hidden rounded-xl border border-[rgba(199,196,215,0.3)] bg-white py-1 shadow-lg">
              <button
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-[#1c1b1b] transition-colors hover:bg-[#f6f3f2]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(contact.id);
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-manrope font-extrabold text-2xl tracking-[-0.4px] text-[#1c1b1b] sm:text-3xl">
              Contatos & Integrações
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-[#464554]">
              Gerencie os contatos que recebem resumos e conecte ferramentas externas.
            </p>
          </div>

          {/* Add contact CTA */}
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-full px-4 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 sm:self-auto"
            style={{
              background: "linear-gradient(135deg, #4648d4, #6063ee)",
              boxShadow:
                "0 10px 15px -3px rgba(70,72,212,0.2), 0 4px 6px -4px rgba(70,72,212,0.2)",
            }}
          >
            <UserPlus className="h-4 w-4" />
            Adicionar contato
          </button>
        </div>

        {/* ── Contacts Section ─────────────────────────────────────────────── */}
        <section>
          {/* Section heading */}
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e1e0ff]">
                <Phone className="h-4 w-4 text-[#4648d4]" />
              </div>
              <h2 className="font-manrope font-extrabold tracking-[-0.2px] text-[#1c1b1b]">
                Contatos WhatsApp
              </h2>
              <span className="inline-flex items-center rounded-full bg-[#e1e0ff] px-2.5 py-0.5 text-xs font-medium text-[#07006c]">
                {contacts.length}
              </span>
            </div>
          </div>

          {/* Search + filter bar */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#464554]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou número..."
                className="w-full rounded-xl border border-[rgba(199,196,215,0.4)] bg-[#f6f3f2] py-2.5 pl-10 pr-4 text-sm text-[#1c1b1b] placeholder-[#464554]/60 outline-none transition-all focus:border-[#4648d4] focus:ring-2 focus:ring-[#4648d4]/20"
              />
            </div>

            {/* Filter tabs */}
            <div className="flex items-center rounded-xl border border-[rgba(199,196,215,0.3)] bg-[#f6f3f2] p-1">
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
                      ? "bg-white text-[#1c1b1b] shadow-sm"
                      : "text-[#464554] hover:text-[#1c1b1b]"
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
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[rgba(199,196,215,0.2)] bg-[#f6f3f2] py-14">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e5e2e1]">
                <Search className="h-5 w-5 text-[#464554]" />
              </div>
              <p className="text-sm font-medium text-[#1c1b1b]">
                Nenhum contato encontrado
              </p>
              <p className="mt-1 text-xs text-[#464554]">
                Tente outro termo ou{" "}
                <button
                  onClick={() => setShowModal(true)}
                  className="text-[#4648d4] underline-offset-2 hover:underline"
                >
                  adicione um contato
                </button>
              </p>
            </div>
          )}

          {/* Summary bar */}
          {contacts.length > 0 && (
            <div className="mt-3 flex items-center gap-4 px-1 text-xs text-[#464554]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {activeCount} ativo{activeCount !== 1 ? "s" : ""}
              </span>
              {inactiveCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[rgba(199,196,215,0.8)]" />
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
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e1e0ff]">
              <Zap className="h-4 w-4 text-[#4648d4]" />
            </div>
            <h2 className="font-manrope font-extrabold tracking-[-0.2px] text-[#1c1b1b]">
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
          <p className="mt-4 text-xs text-[#464554]">
            Integrações marcadas com{" "}
            <span className="inline-flex items-center rounded-full bg-[#e5e2e1] px-2 py-0.5 text-[11px] font-medium text-[#464554]">
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
