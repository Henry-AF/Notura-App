import { ActivityIndicator, Switch, StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme/tokens";
import type { Plan } from "@/lib/user/current-user-api";

// Mirrors `src/components/settings/AutoRenewControl.tsx` on the web —
// same status resolution + copy, simplified to the states mobile actually
// needs (no trial/subscriptionStatus overrides, which the web only passes
// from the billing checkout flow that doesn't exist on mobile yet).
type SubscriptionStatus = "free" | "active" | "expired" | "grace";

const PERIOD_END_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

function formatPeriodEnd(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return PERIOD_END_FORMATTER.format(date);
}

function isPeriodExpired(value: string | null): boolean {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
}

function resolveStatus(
  plan: Plan,
  currentPeriodEnd: string | null,
  renewalStatus: string
): SubscriptionStatus {
  if (plan === "free") return "free";
  if (!isPeriodExpired(currentPeriodEnd)) return "active";
  return renewalStatus === "retrying" ? "grace" : "expired";
}

function getTitle(autoRenewEnabled: boolean, status: SubscriptionStatus): string {
  if (status === "expired") return "Assinatura vencida";
  if (status === "grace") return "Renovação em processamento";
  return autoRenewEnabled ? "Renovação automática ativa" : "Renovação automática desativada";
}

function getDescription(
  autoRenewEnabled: boolean,
  renewalStatus: string,
  currentPeriodEnd: string | null,
  status: SubscriptionStatus
): string {
  if (renewalStatus === "suspended") {
    return "Renovação suspensa após tentativas sem sucesso.";
  }

  const formattedDate = formatPeriodEnd(currentPeriodEnd);
  if (status === "expired") {
    return formattedDate ? `Assinatura vencida em ${formattedDate}.` : "Assinatura vencida.";
  }
  if (status === "grace") {
    return formattedDate
      ? `Estamos tentando renovar sua assinatura desde ${formattedDate}.`
      : "Estamos tentando renovar sua assinatura.";
  }
  if (!formattedDate) return "Renovação vinculada ao ciclo atual.";
  return autoRenewEnabled
    ? `Próxima renovação em ${formattedDate}.`
    : `Plano ativo até ${formattedDate}.`;
}

export interface AutoRenewCardProps {
  plan: Plan;
  currentPeriodEnd: string | null;
  autoRenewEnabled: boolean;
  renewalStatus: string;
  pending?: boolean;
  onChange: (enabled: boolean) => void;
}

export function AutoRenewCard({
  plan,
  currentPeriodEnd,
  autoRenewEnabled,
  renewalStatus,
  pending = false,
  onChange,
}: AutoRenewCardProps) {
  if (plan === "free") return null;

  const status = resolveStatus(plan, currentPeriodEnd, renewalStatus);
  const disabled = pending || renewalStatus === "suspended" || status === "expired" || status === "grace";

  return (
    <View style={styles.card}>
      <View style={styles.iconBox}>
        {pending ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{getTitle(autoRenewEnabled, status)}</Text>
        <Text style={styles.description}>
          {getDescription(autoRenewEnabled, renewalStatus, currentPeriodEnd, status)}
        </Text>
      </View>
      <Switch
        value={autoRenewEnabled}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
  },
  iconBox: {
    width: 32,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.foreground,
  },
  description: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
});
