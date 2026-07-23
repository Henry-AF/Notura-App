import { getEnv } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export async function fetchApi(path: string, init: RequestInit = {}) {
  const { apiBaseUrl } = getEnv();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  if (session?.access_token) {
    headers.set('authorization', `Bearer ${session.access_token}`);
  }
  headers.set('content-type', 'application/json');

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  });

  return response;
}

export async function getCurrentUserFromApi() {
  const response = await fetchApi('/api/user/me');
  if (!response.ok) {
    return null;
  }
  return response.json();
}
