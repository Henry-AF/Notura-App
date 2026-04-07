export function normalizeError(error: unknown, fallback: string) {
  if (typeof error === "string" && error.trim().length > 0) {
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
