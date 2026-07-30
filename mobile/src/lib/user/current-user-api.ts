// Companion helper for the Home screen (`app/(app)/index.tsx`, Rule #8).

import { fetchApi } from '@/lib/api/client';
import { normalizeError, parseJson } from '@/lib/api-client';

interface CurrentUserApiResponse {
  user?: {
    name?: string;
  };
  error?: string;
}

export async function fetchCurrentUserName(): Promise<string> {
  const response = await fetchApi('/api/user/me');
  const body = await parseJson<CurrentUserApiResponse>(response);

  if (!response.ok || !body.user) {
    throw new Error(normalizeError(body.error, 'Erro ao carregar usuário.'));
  }

  return body.user.name?.trim() || 'você';
}
