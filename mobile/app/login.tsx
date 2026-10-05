import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/AuthProvider';
import { FORGOT_PASSWORD_URL, isValidEmail } from '@/lib/auth/auth-links';
import { AuthLayout, authColors } from '@/components/auth/AuthLayout';
import { AuthInput, PasswordInput } from '@/components/auth/AuthFields';
import { GoogleButton, OrDivider, PrimaryAction, TextLinkRow } from '@/components/auth/AuthActions';
import { ThemedText } from '@/components/ui/ThemedText';

const GOOGLE_UNAVAILABLE_MESSAGE = 'Login com Google ainda não está disponível no app.';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { signIn } = useAuth();
  const router = useRouter();

  const isFormValid = isValidEmail(email) && password.length > 0;

  async function handleLogin() {
    if (!isFormValid) {
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
    <AuthLayout
      title="Bem-vindo de volta!"
      subtitle="Entre na sua conta para continuar organizando suas reuniões"
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

      <ThemedText
        variant="caption"
        color="#3D3D3D"
        accessibilityRole="link"
        onPress={() => void Linking.openURL(FORGOT_PASSWORD_URL)}
        style={styles.forgot}
      >
        Esqueceu a senha?
      </ThemedText>

      {errorMessage ? (
        <ThemedText variant="footnote" color={authColors.error} style={styles.message}>
          {errorMessage}
        </ThemedText>
      ) : null}

      <PrimaryAction
        label="Sign In"
        loading={isSubmitting}
        disabled={!isFormValid}
        onPress={() => void handleLogin()}
      />

      <OrDivider />
      <GoogleButton onPress={() => setErrorMessage(GOOGLE_UNAVAILABLE_MESSAGE)} />

      <TextLinkRow
        prefix="Novo por aqui? Crie um "
        action="Cadastro"
        onPress={() => router.push('/signup')}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 16 },
  forgot: { alignSelf: 'flex-end', marginTop: 10, marginBottom: 20 },
  message: { marginBottom: 12, textAlign: 'center' },
});
