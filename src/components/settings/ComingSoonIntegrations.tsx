"use client";

import React from "react";
import { Calendar, Chrome, Video, type LucideIcon } from "lucide-react";
import {
  INTEGRATION_CHANNELS,
  type IntegrationChannel,
} from "@/lib/integrations/integration-interest";
import { IntegrationWaitlistAction } from "@/components/integrations/IntegrationWaitlistAction";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ComingSoonIntegrationsProps {
  registeredChannels: IntegrationChannel[];
  registeringChannel: IntegrationChannel | null;
  onRegisterInterest: (channel: IntegrationChannel) => void;
}

interface ChannelConfig {
  name: string;
  description: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

// ─── Static config ────────────────────────────────────────────────────────────

const CHANNEL_CONFIG: Record<IntegrationChannel, ChannelConfig> = {
  zoom: {
    name: "Zoom",
    description: "Em breve — avisaremos quando estiver disponível.",
    icon: Video,
    iconBg: "rgba(37,99,235,0.12)",
    iconColor: "#2563EB",
  },
  chrome_extension: {
    name: "Extensão Chrome",
    description: "Em breve — avisaremos quando estiver disponível.",
    icon: Chrome,
    iconBg: "rgba(234,88,12,0.12)",
    iconColor: "#EA580C",
  },
  google_calendar: {
    name: "Google Agenda",
    description: "Saiba quando é a próxima reunião do seu cliente.",
    icon: Calendar,
    iconBg: "rgba(22,163,74,0.12)",
    iconColor: "#16A34A",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ComingSoonIntegrations({
  registeredChannels,
  registeringChannel,
  onRegisterInterest,
}: ComingSoonIntegrationsProps) {
  return (
    <div className="rounded-2xl border border-notura-border bg-notura-surface p-6">
      <h3 className="font-display text-[17px] font-bold tracking-[-0.01em] text-notura-ink">
        Integrações em breve
      </h3>
      <p className="mt-1 text-[13px] text-notura-ink-secondary">
        Ainda não estão disponíveis, mas você pode ser avisado assim que
        lançarmos.
      </p>

      <div className="mt-4">
        {INTEGRATION_CHANNELS.map((channel, index) => (
          <React.Fragment key={channel}>
            {index > 0 && <div className="h-px bg-notura-border" />}
            <ChannelRow
              channel={channel}
              registered={registeredChannels.includes(channel)}
              pending={registeringChannel === channel}
              onRegisterInterest={onRegisterInterest}
            />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function ChannelRow({
  channel,
  registered,
  pending,
  onRegisterInterest,
}: {
  channel: IntegrationChannel;
  registered: boolean;
  pending: boolean;
  onRegisterInterest: (channel: IntegrationChannel) => void;
}) {
  const config = CHANNEL_CONFIG[channel];
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: config.iconBg }}
        >
          <Icon className="size-4.5" style={{ color: config.iconColor }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-notura-ink">{config.name}</p>
          <p className="truncate text-xs text-notura-ink-secondary">
            {config.description}
          </p>
        </div>
      </div>

      <IntegrationWaitlistAction
        channel={channel}
        registered={registered}
        pending={pending}
        onRegister={onRegisterInterest}
      />
    </div>
  );
}
