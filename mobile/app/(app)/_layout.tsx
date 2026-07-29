import { Redirect, usePathname, useRouter } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import {
  DrawerContentScrollView,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';

// Mirrors the web sidebar (`src/app/dashboard/dashboard-layout-client.tsx`):
// same icon and destination per item. Grupos/Modelos de Ata/Chats aren't
// implemented on mobile yet, so they're intentionally left out here rather
// than linking to routes that don't exist.
interface DrawerNavItem {
  route: string;
  match: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const NAV_ITEMS: DrawerNavItem[] = [
  { route: '/(app)', match: '/', label: 'Dashboard', icon: 'grid-outline' },
  { route: '/(app)/meetings', match: '/meetings', label: 'Reuniões', icon: 'videocam-outline' },
  { route: '/(app)/tasks', match: '/tasks', label: 'Tarefas', icon: 'checkbox-outline' },
  { route: '/(app)/profile', match: '/profile', label: 'Perfil', icon: 'person-outline' },
];

function DrawerNavRow({ item }: { item: DrawerNavItem }) {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const active = pathname === item.match;

  return (
    <Pressable
      onPress={() => router.push(item.route as never)}
      style={[
        styles.navRow,
        {
          paddingVertical: spacing.sm + 2,
          paddingHorizontal: spacing.md,
          borderRadius: radius.md,
          backgroundColor: active ? colors.secondary : 'transparent',
        },
      ]}
    >
      <Ionicons
        name={item.icon}
        size={20}
        color={active ? colors.primary : colors.mutedForeground}
      />
      <ThemedText variant="body" color={active ? colors.foreground : colors.mutedForeground}>
        {item.label}
      </ThemedText>
    </Pressable>
  );
}

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { colors, spacing } = useTheme();
  const { user, signOut } = useAuth();

  return (
    <DrawerContentScrollView
      {...props}
      style={{ backgroundColor: colors.card }}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.sm }}
    >
      <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.lg }}>
        <ThemedText variant="title2">Notura</ThemedText>
      </View>

      <View style={styles.navList}>
        {NAV_ITEMS.map((item) => (
          <DrawerNavRow key={item.route} item={item} />
        ))}
      </View>

      <View style={styles.footer}>
        <ThemedText
          variant="footnote"
          color={colors.mutedForeground}
          numberOfLines={1}
          style={{ paddingHorizontal: spacing.md }}
        >
          {user?.email}
        </ThemedText>
        <Pressable
          onPress={() => void signOut()}
          style={[styles.navRow, { paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md }]}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <ThemedText variant="body" color={colors.error}>
            Sair
          </ThemedText>
        </Pressable>
      </View>
    </DrawerContentScrollView>
  );
}

export default function AppLayout() {
  const { isLoading, isAuthenticated } = useAuth();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <Screen style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
        drawerStyle: { backgroundColor: colors.card, width: 280 },
      }}
    >
      <Drawer.Screen name="index" options={{ title: 'Dashboard' }} />
      <Drawer.Screen name="meetings/index" options={{ title: 'Reuniões' }} />
      <Drawer.Screen name="tasks" options={{ title: 'Tarefas' }} />
      <Drawer.Screen name="profile" options={{ title: 'Perfil' }} />
      <Drawer.Screen name="record" options={{ title: 'Gravar' }} />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navList: {
    gap: 2,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footer: {
    marginTop: 'auto',
    gap: 8,
    paddingVertical: 16,
  },
});
