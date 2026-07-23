export function getEnv() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://app.notura.com.br';

  if (!url) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL');
  }
  if (!anonKey) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }

  return { url, anonKey, apiBaseUrl } as const;
}
