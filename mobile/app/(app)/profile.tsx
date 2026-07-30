import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getEnv } from "@/lib/env";
import {
  fetchCurrentUser,
  getPlanTitle,
  updateAutoRenew,
  updateCurrentUser,
  type CurrentUser,
} from "@/lib/user/current-user-api";
import { colors } from "@/lib/theme/tokens";
import { AutoRenewCard } from "@/components/profile/AutoRenewCard";

type Tab = "profile" | "preferences" | "plan";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Perfil" },
  { id: "preferences", label: "Preferências" },
  { id: "plan", label: "Plano" },
];

// Mirrors `buildPrefs()` in the web's SettingsModal — these two toggles are
// local-only there too (no persistence endpoint exists yet on either
// platform). "Modo escuro" is intentionally left out: mobile doesn't have a
// light/dark theme system to toggle (NOT-136 tokens are dark-only for now).
interface LocalPref {
  id: "whatsapp" | "email";
  icon: string;
  label: string;
  description: string;
}

const LOCAL_PREFS: LocalPref[] = [
  {
    id: "whatsapp",
    icon: "💬",
    label: "Resumo via WhatsApp",
    description: "Receba resumos das reuniões no WhatsApp",
  },
  {
    id: "email",
    icon: "📧",
    label: "Notificações por e-mail",
    description: "Avisos sobre tarefas e prazos",
  },
];

function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return initials || "U";
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [prefValues, setPrefValues] = useState<Record<LocalPref["id"], boolean>>({
    whatsapp: true,
    email: false,
  });

  const [isAutoRenewSaving, setIsAutoRenewSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchCurrentUser();
      setCurrentUser(data);
      setName(data.name);
      setCompany(data.company);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar perfil.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSaveProfile() {
    setIsSaving(true);
    try {
      const updated = await updateCurrentUser({ name: name.trim(), company: company.trim() });
      setCurrentUser(updated);
      Alert.alert("Perfil atualizado");
    } catch (err) {
      Alert.alert("Erro", err instanceof Error ? err.message : "Erro ao salvar perfil.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAutoRenewChange(enabled: boolean) {
    if (!currentUser) return;
    setIsAutoRenewSaving(true);
    try {
      const status = await updateAutoRenew(enabled);
      setCurrentUser((previous) => (previous ? { ...previous, ...status } : previous));
    } catch (err) {
      Alert.alert("Erro", err instanceof Error ? err.message : "Erro ao atualizar renovação.");
    } finally {
      setIsAutoRenewSaving(false);
    }
  }

  function handleUpgradePress() {
    const { apiBaseUrl } = getEnv();
    void Linking.openURL(`${apiBaseUrl}/dashboard`);
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const displayName = currentUser?.name || user?.email?.split("@")[0] || "Usuário";
  const displayEmail = currentUser?.email || user?.email || "";
  const monthlyLimit = currentUser?.monthlyLimit ?? 0;
  const hasLimit = monthlyLimit > 0;
  const meetingsUsed = currentUser?.meetingsThisMonth ?? 0;
  const usagePct = hasLimit ? Math.min(100, Math.round((meetingsUsed / monthlyLimit) * 100)) : 100;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.plan}>
            {currentUser ? getPlanTitle(currentUser.plan) : ""}
          </Text>
        </View>

        <View style={styles.tabRow}>
          {TABS.map((t) => (
            <Pressable
              key={t.id}
              style={[styles.tabButton, tab === t.id && styles.tabButtonActive]}
              onPress={() => setTab(t.id)}
            >
              <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {tab === "profile" ? (
          <View style={styles.section}>
            <Text style={styles.label}>Nome completo</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={styles.label}>E-mail</Text>
            <View style={[styles.input, styles.inputDisabled]}>
              <Text style={styles.inputDisabledText}>{displayEmail}</Text>
            </View>
            <Text style={styles.hint}>O e-mail não pode ser alterado.</Text>

            <Text style={styles.label}>Empresa</Text>
            <TextInput
              style={styles.input}
              value={company}
              onChangeText={setCompany}
              placeholder="Nome da sua empresa"
              placeholderTextColor={colors.mutedForeground}
            />

            <Pressable
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={() => void handleSaveProfile()}
              disabled={isSaving}
            >
              <Text style={styles.saveButtonText}>
                {isSaving ? "Salvando..." : "Salvar alterações"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {tab === "preferences" ? (
          <View style={styles.section}>
            {LOCAL_PREFS.map((pref) => (
              <View key={pref.id} style={styles.prefRow}>
                <View style={styles.prefIcon}>
                  <Text style={styles.prefIconText}>{pref.icon}</Text>
                </View>
                <View style={styles.prefContent}>
                  <Text style={styles.prefLabel}>{pref.label}</Text>
                  <Text style={styles.prefDescription}>{pref.description}</Text>
                </View>
                <Switch
                  value={prefValues[pref.id]}
                  onValueChange={(value) =>
                    setPrefValues((previous) => ({ ...previous, [pref.id]: value }))
                  }
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#ffffff"
                />
              </View>
            ))}
          </View>
        ) : null}

        {tab === "plan" && currentUser ? (
          <View style={styles.section}>
            <View style={styles.planCard}>
              <Text style={styles.planCardEyebrow}>Plano atual</Text>
              <Text style={styles.planCardTitle}>{getPlanTitle(currentUser.plan)}</Text>
            </View>

            <View style={styles.usageCard}>
              <View style={styles.usageRow}>
                <Text style={styles.usageLabel}>Reuniões este mês</Text>
                <Text style={styles.usageValue}>
                  {hasLimit ? `${meetingsUsed} / ${monthlyLimit}` : "Limite personalizado"}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${usagePct}%` }]} />
              </View>
              <Text style={styles.usageHint}>
                {hasLimit
                  ? `${Math.max(0, monthlyLimit - meetingsUsed)} reuniões restantes`
                  : "Limite personalizado no plano atual"}
              </Text>
            </View>

            <AutoRenewCard
              plan={currentUser.plan}
              currentPeriodEnd={currentUser.currentPeriodEnd}
              autoRenewEnabled={currentUser.autoRenewEnabled}
              renewalStatus={currentUser.renewalStatus}
              pending={isAutoRenewSaving}
              onChange={(enabled) => void handleAutoRenewChange(enabled)}
            />

            {currentUser.plan === "free" ? (
              <Pressable style={styles.upgradeButton} onPress={handleUpgradePress}>
                <Text style={styles.upgradeButtonText}>⚡ Fazer upgrade para Pro</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Pressable style={styles.logoutButton} onPress={() => void signOut()}>
          <Text style={styles.logoutButtonText}>Sair da conta</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.primaryForeground,
  },
  name: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: "700",
    color: colors.foreground,
  },
  plan: {
    marginTop: 2,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
    backgroundColor: colors.card2,
  },
  tabButtonActive: {
    backgroundColor: "rgba(139,122,255,0.18)",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.mutedForeground,
  },
  tabTextActive: {
    color: colors.primary,
  },
  errorBanner: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,107,107,0.12)",
  },
  errorText: {
    fontSize: 12,
    color: colors.destructive,
  },
  section: {
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.card2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.foreground,
  },
  inputDisabled: {
    justifyContent: "center",
  },
  inputDisabledText: {
    fontSize: 15,
    color: colors.mutedForeground,
  },
  hint: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  saveButton: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.primaryForeground,
    fontWeight: "700",
    fontSize: 15,
  },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card2,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  prefIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(139,122,255,0.15)",
  },
  prefIconText: {
    fontSize: 16,
  },
  prefContent: {
    flex: 1,
    minWidth: 0,
  },
  prefLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.foreground,
  },
  prefDescription: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  planCard: {
    backgroundColor: "rgba(139,122,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(139,122,255,0.25)",
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
  },
  planCardEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  planCardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.foreground,
    marginTop: 4,
  },
  usageCard: {
    backgroundColor: colors.card2,
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
  },
  usageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  usageLabel: {
    fontSize: 13,
    color: colors.secondaryForeground,
  },
  usageValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.foreground,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: "hidden",
    marginTop: 10,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  usageHint: {
    marginTop: 8,
    fontSize: 11,
    color: colors.mutedForeground,
    textAlign: "right",
  },
  upgradeButton: {
    marginTop: 4,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  upgradeButtonText: {
    color: colors.primaryForeground,
    fontWeight: "700",
    fontSize: 15,
  },
  logoutButton: {
    marginTop: 28,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,107,107,0.1)",
  },
  logoutButtonText: {
    color: colors.destructive,
    fontWeight: "700",
    fontSize: 14,
  },
});
