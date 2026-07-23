import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function ConfirmScreen() {
  const { token, type } = useLocalSearchParams<{ token?: string; type?: string }>();

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

  return (
    <View style={styles.container}>
      {status === 'loading' && <ActivityIndicator size="large" />}
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
});
