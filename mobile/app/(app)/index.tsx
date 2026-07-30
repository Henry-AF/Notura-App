import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { BannerCarousel } from '@/components/dashboard/BannerCarousel';
import { fetchCurrentUserName } from '@/lib/user/current-user-api';

// Mirrors `src/components/dashboard/DashboardHeader.tsx` on the web app.
function getGreeting(): { text: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { text: 'Bom dia', emoji: '👋' };
  if (hour >= 12 && hour < 18) return { text: 'Boa tarde', emoji: '☀️' };
  return { text: 'Boa noite', emoji: '🌙' };
}

export default function HomeScreen() {
  const router = useRouter();
  const { colors, radius, spacing } = useTheme();
  const [userName, setUserName] = useState<string | null>(null);
  const greeting = getGreeting();

  useEffect(() => {
    fetchCurrentUserName()
      .then(setUserName)
      .catch(() => setUserName('você'));
  }, []);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText variant="title1">
            {greeting.text}, {userName ?? '...'} {greeting.emoji}
          </ThemedText>

          <Pressable
            onPress={() => router.push('/(app)/record')}
            style={({ pressed }) => [
              styles.newMeetingButton,
              { backgroundColor: colors.primary, borderRadius: radius.full, marginTop: spacing.md },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="add" size={18} color={colors.primaryForeground} />
            <ThemedText variant="headline" color={colors.primaryForeground}>
              Nova reunião
            </ThemedText>
          </Pressable>
        </View>

        <BannerCarousel />

        <View style={styles.quickActions}>
          <ThemedText variant="title2" style={styles.quickActionsTitle}>
            Como sua reunião vai ser feita hoje?
          </ThemedText>

          <Pressable
            onPress={() => router.push('/(app)/record')}
            style={({ pressed }) => [styles.quickActionCard, pressed && styles.pressed]}
          >
            <LinearGradient
              colors={['#6851FF', '#9B87FF', '#1A0F4E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: radius.lg }]}
            />
            <View style={styles.quickActionContent}>
              <ThemedText variant="headline" color="#FFFFFF">
                Gravar reunião
              </ThemedText>
              <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.8)" />
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 24,
    paddingBottom: 24,
  },
  header: {
    gap: 4,
  },
  newMeetingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  pressed: {
    opacity: 0.85,
  },
  quickActions: {
    gap: 12,
  },
  quickActionsTitle: {
    marginBottom: 0,
  },
  quickActionCard: {
    height: 128,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 16,
  },
  quickActionContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
});
