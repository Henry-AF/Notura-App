import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { signIn } = useAuth();
  const router = useRouter();
  const { colors, spacing } = useTheme();

  async function handleLogin() {
    if (!email || !password) {
      setErrorMessage('Preencha e-mail e senha.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const { error } = await signIn(email, password);

    if (error) {
      setErrorMessage(error.message);
    } else {
      router.replace('/(app)');
    }

    setIsSubmitting(false);
  }

  return (
    <Screen style={styles.container}>
      <ThemedText variant="title1" style={styles.title}>
        Entrar no Notura
      </ThemedText>

      <View style={{ gap: spacing.sm }}>
        <Input
          placeholder="E-mail"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Input
          placeholder="Senha"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      </View>

      {errorMessage ? (
        <ThemedText variant="footnote" color={colors.error} style={styles.error}>
          {errorMessage}
        </ThemedText>
      ) : null}

      <Button
        label={isSubmitting ? 'Entrando...' : 'Entrar'}
        onPress={() => void handleLogin()}
        disabled={isSubmitting}
        style={styles.button}
      />

      <Link href="/signup" asChild>
        <Button label="Criar conta" variant="ghost" style={styles.linkButton} />
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  title: {
    marginBottom: 24,
    textAlign: 'center',
  },
  error: {
    marginTop: 12,
    textAlign: 'center',
  },
  button: {
    marginTop: 16,
  },
  linkButton: {
    marginTop: 8,
  },
});
