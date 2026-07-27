import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getCurrentUserFromApi } from '@/lib/api/client';
import { useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { Button } from '@/components/ui/Button';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [apiUser, setApiUser] = useState<unknown>(null);
  const { colors } = useTheme();

  useEffect(() => {
    console.log('[NOT-112] Tela Perfil montada');
  }, []);

  useEffect(() => {
    getCurrentUserFromApi().then((data) => {
      if (data) setApiUser(data);
    });
  }, []);

  return (
    <Screen style={styles.container}>
      <ThemedText variant="title1" style={styles.title}>
        Perfil
      </ThemedText>
      <ThemedText variant="body" color={colors.mutedForeground} style={styles.subtitle}>
        Em construção
      </ThemedText>

      <ThemedText variant="footnote" color={colors.mutedForeground} style={styles.label}>
        Logado como:
      </ThemedText>
      <ThemedText variant="headline" style={styles.email}>
        {user?.email ?? 'Desconhecido'}
      </ThemedText>

      <ThemedText variant="footnote" color={colors.mutedForeground} style={styles.label}>
        Resposta da API:
      </ThemedText>
      <ThemedText variant="caption" color={colors.secondaryForeground} style={styles.apiUser}>
        {apiUser ? JSON.stringify(apiUser, null, 2) : 'Carregando...'}
      </ThemedText>

      <Button label="Sair" variant="secondary" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  title: {
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    marginTop: 12,
  },
  email: {
    marginBottom: 16,
  },
  apiUser: {
    marginBottom: 24,
  },
});
