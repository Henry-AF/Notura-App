import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getCurrentUserFromApi } from '@/lib/api/client';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [apiUser, setApiUser] = useState<unknown>(null);

  useEffect(() => {
    console.log('[NOT-112] Tela Perfil montada');
  }, []);

  useEffect(() => {
    getCurrentUserFromApi().then((data) => {
      if (data) setApiUser(data);
    });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Perfil</Text>
      <Text style={styles.subtitle}>Em construção</Text>

      <Text style={styles.label}>Logado como:</Text>
      <Text style={styles.email}>{user?.email ?? 'Desconhecido'}</Text>

      <Text style={styles.label}>Resposta da API:</Text>
      <Text style={styles.apiUser}>{apiUser ? JSON.stringify(apiUser, null, 2) : 'Carregando...'}</Text>

      <TouchableOpacity style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Sair</Text>
      </TouchableOpacity>
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
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 12,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  apiUser: {
    fontSize: 12,
    color: '#334155',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#dc2626',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
