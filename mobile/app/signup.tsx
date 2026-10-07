import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/AuthProvider';
import { isValidEmail } from '@/lib/auth/auth-links';
import { AuthLayout, authColors } from '@/components/auth/AuthLayout';
import { AuthInput, PasswordInput } from '@/components/auth/AuthFields';
import { GoogleButton, OrDivider, PrimaryAction, TextLinkRow } from '@/components/auth/AuthActions';
import { ThemedText } from '@/components/ui/ThemedText';

const MIN_PASSWORD_LENGTH = 6;
const GOOGLE_UNAVAILABLE_MESSAGE = 'Login com Google ainda não está disponível no app.';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { signUp } = useAuth();
  const router = useRouter();

  const isFormValid = isValidEmail(email) && password.length >= MIN_PASSWORD_LENGTH;

  async function handleSignUp() {
    if (!isFormValid) {
      setErrorMessage('Informe um e-mail válido e uma senha com pelo menos 6 caracteres.');
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
    <AuthLayout
      title="Crie sua conta"
      subtitle="Comece a transformar suas reuniões em decisões acionáveis"
    >
      <View style={styles.fields}>
        <AuthInput
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />
        <PasswordInput value={password} onChangeText={setPassword} />
      </View>

      {errorMessage ? (
        <ThemedText variant="footnote" color={authColors.error} style={styles.message}>
          {errorMessage}
        </ThemedText>
      ) : null}
      {successMessage ? (
        <ThemedText variant="footnote" color={authColors.success} style={styles.message}>
          {successMessage}
        </ThemedText>
      ) : null}

      <PrimaryAction
        label="Criar conta"
        loading={isSubmitting}
        disabled={!isFormValid}
        onPress={() => void handleSignUp()}
      />

      <OrDivider />
      <GoogleButton onPress={() => setErrorMessage(GOOGLE_UNAVAILABLE_MESSAGE)} />

      <TextLinkRow
        prefix="Já tem conta? "
        action="Entrar"
        onPress={() => router.replace('/login')}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 16, marginBottom: 20 },
  message: { marginBottom: 12, textAlign: 'center' },
});
