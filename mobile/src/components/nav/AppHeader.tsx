import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { ThemedText } from '@/components/ui/ThemedText';

interface AppHeaderProps extends NativeStackHeaderProps {
  onMenuPress: () => void;
}

/** Shared header for every `(app)` screen: hamburger button + centered title, no navigator chrome. */
export function AppHeader({ options, onMenuPress }: AppHeaderProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
          paddingTop: insets.top,
          paddingHorizontal: spacing.md,
        },
      ]}
    >
      <Pressable onPress={onMenuPress} hitSlop={12} style={styles.iconButton}>
        <Ionicons name="menu-outline" size={24} color={colors.foreground} />
      </Pressable>
      <ThemedText variant="headline" numberOfLines={1} style={styles.title}>
        {options.title ?? ''}
      </ThemedText>
      <View style={styles.iconButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconButton: {
    width: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
});
