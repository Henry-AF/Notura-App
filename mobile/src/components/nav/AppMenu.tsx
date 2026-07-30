import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useTheme } from '@/theme';
import { ThemedText } from '@/components/ui/ThemedText';

const PANEL_WIDTH = 280;
const ANIMATION_MS = 220;

// Mirrors the web sidebar (`src/app/dashboard/dashboard-layout-client.tsx`):
// same items, icons and order. Grupos/Modelos de Ata/Chats route to "coming
// soon" placeholder screens on mobile — see app/(app)/{groups,templates,chats}.tsx.
interface MenuItem {
  route: string;
  match: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const MENU_ITEMS: MenuItem[] = [
  { route: '/(app)', match: '/', label: 'Dashboard', icon: 'grid-outline' },
  { route: '/(app)/meetings', match: '/meetings', label: 'Reuniões', icon: 'videocam-outline' },
  { route: '/(app)/groups', match: '/groups', label: 'Grupos', icon: 'folder-outline' },
  { route: '/(app)/tasks', match: '/tasks', label: 'Tarefas', icon: 'checkbox-outline' },
  { route: '/(app)/templates', match: '/templates', label: 'Modelos de Ata', icon: 'document-text-outline' },
  { route: '/(app)/chats', match: '/chats', label: 'Chats', icon: 'chatbubble-ellipses-outline' },
];

interface AppMenuProps {
  visible: boolean;
  onClose: () => void;
}

export function AppMenu({ visible, onClose }: AppMenuProps) {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const [mounted, setMounted] = useState(visible);
  const translateX = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(translateX, { toValue: 0, duration: ANIMATION_MS, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: ANIMATION_MS, useNativeDriver: true }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(translateX, { toValue: -PANEL_WIDTH, duration: ANIMATION_MS, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: ANIMATION_MS, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, translateX, backdropOpacity]);

  if (!mounted) return null;

  function navigate(route: string) {
    onClose();
    router.push(route as never);
  }

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}
          />
        </Pressable>

        <Animated.View
          style={[
            styles.panel,
            {
              width: PANEL_WIDTH,
              backgroundColor: colors.card,
              paddingTop: insets.top + spacing.sm,
              paddingBottom: insets.bottom + spacing.sm,
              transform: [{ translateX }],
            },
          ]}
        >
          <View style={[styles.header, { paddingHorizontal: spacing.md }]}>
            <ThemedText variant="title2">Notura</ThemedText>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close-outline" size={24} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <View style={[styles.navList, { paddingHorizontal: spacing.sm }]}>
            {MENU_ITEMS.map((item) => {
              const active = pathname === item.match;
              return (
                <Pressable
                  key={item.route}
                  onPress={() => navigate(item.route)}
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
            })}
          </View>

          <View style={[styles.footer, { paddingHorizontal: spacing.sm }]}>
            <ThemedText
              variant="footnote"
              color={colors.mutedForeground}
              numberOfLines={1}
              style={{ paddingHorizontal: spacing.md }}
            >
              {user?.email}
            </ThemedText>

            <Pressable
              onPress={() => navigate('/(app)/profile')}
              style={[styles.navRow, { paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md }]}
            >
              <Ionicons name="settings-outline" size={20} color={colors.mutedForeground} />
              <ThemedText variant="body" color={colors.mutedForeground}>
                Configurações
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => {
                onClose();
                void signOut();
              }}
              style={[styles.navRow, { paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md }]}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
              <ThemedText variant="body" color={colors.error}>
                Sair
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  panel: {
    height: '100%',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  navList: {
    gap: 2,
    marginTop: 8,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footer: {
    marginTop: 'auto',
    gap: 8,
  },
});
