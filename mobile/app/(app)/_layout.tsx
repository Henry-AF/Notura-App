import { useState } from 'react';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { AppHeader } from '@/components/nav/AppHeader';
import { AppMenu } from '@/components/nav/AppMenu';

export default function AppLayout() {
  const { isLoading, isAuthenticated } = useAuth();
  const { colors } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

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
    <>
      <Stack
        screenOptions={{
          header: (props) => <AppHeader {...props} onMenuPress={() => setMenuOpen(true)} />,
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Dashboard' }} />
        <Stack.Screen name="meetings/index" options={{ title: 'Reuniões' }} />
        <Stack.Screen name="meetings/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="groups" options={{ title: 'Grupos' }} />
        <Stack.Screen name="tasks" options={{ title: 'Tarefas' }} />
        <Stack.Screen name="templates" options={{ title: 'Modelos de Ata' }} />
        <Stack.Screen name="chats" options={{ title: 'Chats' }} />
        <Stack.Screen name="profile" options={{ title: 'Perfil' }} />
        <Stack.Screen name="record" options={{ title: 'Gravar' }} />
      </Stack>

      <AppMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
