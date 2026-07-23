import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function MeetingsScreen() {
  useEffect(() => {
    console.log('[NOT-112] Tela Reuniões montada');
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reuniões</Text>
      <Text style={styles.subtitle}>Em construção</Text>
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
    textAlign: 'center',
  },
});
