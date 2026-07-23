// Mirrors the shared helpers in the web app's `src/lib/api-client.ts`.
// Duplicated here (rather than imported) because the mobile app is a
// separate package (Expo) with no shared module boundary with the Next.js app.

export function normalizeError(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
