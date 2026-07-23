import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/lib/auth/AuthProvider';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="login" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="signup" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="confirm" options={{ animation: 'none' }} />
        <Stack.Screen name="(app)" options={{ animation: 'none' }} />
      </Stack>
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
