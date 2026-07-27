import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';

export default function ConfirmScreen() {
  const { token, type } = useLocalSearchParams<{ token?: string; type?: string }>();
  const { colors } = useTheme();

  const initialState = useMemo(() => {
    if (type !== 'signup' || !token) {
      return { status: 'error' as const, message: 'Link de confirmação inválido.' };
    }
    return { status: 'loading' as const, message: 'Confirmando e-mail...' };
  }, [token, type]);

  const [status, setStatus] = useState<'error' | 'loading' | 'success'>(initialState.status);
  const [message, setMessage] = useState(initialState.message);

  useEffect(() => {
    if (type !== 'signup' || !token) return;

    let cancelled = false;

    supabase.auth.verifyOtp({ token_hash: token, type: 'signup' }).then(({ error }) => {
      if (cancelled) return;
      if (error) {
        setStatus('error');
        setMessage(error.message);
      } else {
        setStatus('success');
        setMessage('E-mail confirmado! Você pode fechar esta tela e fazer login.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [token, type]);

  const messageColor = status === 'error' ? colors.error : colors.foreground;

  return (
    <Screen style={styles.container}>
      {status === 'loading' && <ActivityIndicator size="large" color={colors.primary} />}
      <ThemedText variant="body" color={messageColor} style={styles.message}>
        {message}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    marginTop: 16,
    textAlign: 'center',
  },
});
