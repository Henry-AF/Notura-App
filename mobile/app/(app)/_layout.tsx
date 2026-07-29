import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';

function TabBarIcon({
  name,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Ionicons name={name} size={22} color={focused ? colors.primary : colors.mutedForeground} />
  );
}

function TabBarLabel({ title, focused }: { title: string; focused: boolean }) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.label, { color: focused ? colors.primary : colors.mutedForeground }]}>
      {title}
    </Text>
  );
}

function RecordTabButton(props: BottomTabBarButtonProps) {
  const { onPress, onLongPress, accessibilityState, accessibilityLabel, testID } = props;
  const focused = accessibilityState?.selected ?? false;
  const { colors, radius } = useTheme();

  return (
    <Pressable
      style={styles.recordButtonContainer}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <View
        style={[
          styles.recordButton,
          {
            backgroundColor: focused ? colors.primaryDark : colors.primary,
            borderRadius: radius.full,
            shadowColor: colors.shadow,
          },
        ]}
      >
        <Text style={[styles.recordButtonText, { color: colors.primaryForeground }]}>
          Gravar
        </Text>
      </View>
    </Pressable>
  );
}

export default function AppLayout() {
  const { isLoading, isAuthenticated } = useAuth();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <Screen style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Reuniões',
          tabBarLabel: ({ focused }) => <TabBarLabel title="Reuniões" focused={focused} />,
          tabBarIcon: ({ focused }) => <TabBarIcon name="calendar-outline" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: 'Gravar',
          tabBarButton: (props) => <RecordTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tarefas',
          tabBarLabel: ({ focused }) => <TabBarLabel title="Tarefas" focused={focused} />,
          tabBarIcon: ({ focused }) => <TabBarIcon name="checkbox-outline" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarLabel: ({ focused }) => <TabBarLabel title="Perfil" focused={focused} />,
          tabBarIcon: ({ focused }) => <TabBarIcon name="person-outline" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
  },
  recordButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButton: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 5,
  },
  recordButtonText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
