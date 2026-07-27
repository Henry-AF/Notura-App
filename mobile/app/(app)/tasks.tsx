import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';

export default function TasksScreen() {
  const { colors } = useTheme();

  useEffect(() => {
    console.log('[NOT-112] Tela Tarefas montada');
  }, []);

  return (
    <Screen style={styles.container}>
      <ThemedText variant="title1" style={styles.title}>
        Tarefas
      </ThemedText>
      <ThemedText variant="body" color={colors.mutedForeground} style={styles.subtitle}>
        Em construção
      </ThemedText>
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
    textAlign: 'center',
  },
});
