import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/lib/auth/AuthProvider';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { signUp } = useAuth();

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
    <View style={styles.container}>
      <Text style={styles.title}>Criar conta</Text>

      <TextInput
        style={styles.input}
        placeholder="E-mail"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Senha"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={isSubmitting}>
        <Text style={styles.buttonText}>{isSubmitting ? 'Criando conta...' : 'Criar conta'}</Text>
      </TouchableOpacity>

      <Link href="/login" asChild>
        <TouchableOpacity style={styles.linkButton}>
          <Text style={styles.linkText}>Já tenho conta</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#0f172a',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: '#2563eb',
  },
  error: {
    color: '#dc2626',
    marginBottom: 12,
    textAlign: 'center',
  },
  success: {
    color: '#16a34a',
    marginBottom: 12,
    textAlign: 'center',
  },
});
