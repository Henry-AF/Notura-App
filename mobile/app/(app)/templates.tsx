import { StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';

export default function TemplatesScreen() {
  const { colors } = useTheme();

  return (
    <Screen style={styles.container}>
      <ThemedText variant="title1" style={styles.title}>
        Modelos de Ata
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
