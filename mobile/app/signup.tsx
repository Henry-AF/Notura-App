import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { signUp } = useAuth();
  const { colors, spacing } = useTheme();

  async function handleSignUp() {
    if (!email || !password) {
      setErrorMessage('Preencha e-mail e senha.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { error } = await signUp(email, password);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setSuccessMessage('Conta criada! Verifique seu e-mail para confirmar.');
    }

    setIsSubmitting(false);
  }

  return (
    <Screen style={styles.container}>
      <ThemedText variant="title1" style={styles.title}>
        Criar conta
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
        <ThemedText variant="footnote" color={colors.error} style={styles.message}>
          {errorMessage}
        </ThemedText>
      ) : null}
      {successMessage ? (
        <ThemedText variant="footnote" color={colors.success} style={styles.message}>
          {successMessage}
        </ThemedText>
      ) : null}

      <Button
        label={isSubmitting ? 'Criando conta...' : 'Criar conta'}
        onPress={() => void handleSignUp()}
        disabled={isSubmitting}
        style={styles.button}
      />

      <Link href="/login" asChild>
        <Button label="Já tenho conta" variant="ghost" style={styles.linkButton} />
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
  message: {
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
