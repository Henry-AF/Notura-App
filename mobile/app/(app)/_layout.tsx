import { Redirect, Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/lib/auth/AuthProvider';

function TabBarLabel({ title, focused }: { title: string; focused: boolean }) {
  return (
    <Text style={[styles.label, focused && styles.labelFocused]}>
      {title}
    </Text>
  );
}

function RecordTabButton(props: BottomTabBarButtonProps) {
  const { onPress, onLongPress, accessibilityState, accessibilityLabel, testID } = props;
  const focused = accessibilityState?.selected ?? false;

  return (
    <Pressable
      style={styles.recordButtonContainer}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <View style={[styles.recordButton, focused && styles.recordButtonFocused]}>
        <Text style={styles.recordButtonText}>Gravar</Text>
      </View>
    </Pressable>
  );
}

export default function AppLayout() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Carregando...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0f172a',
        tabBarInactiveTintColor: '#64748b',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Reuniões',
          tabBarLabel: ({ focused }) => <TabBarLabel title="Reuniões" focused={focused} />,
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
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarLabel: ({ focused }) => <TabBarLabel title="Perfil" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  loading: {
    fontSize: 16,
    color: '#64748b',
  },
  label: {
    fontSize: 12,
    color: '#64748b',
  },
  labelFocused: {
    color: '#0f172a',
    fontWeight: '600',
  },
  recordButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  recordButtonFocused: {
    backgroundColor: '#b91d1d',
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
