import { normalizeError, parseJson } from "@/lib/api-client";

interface MeetingDeleteResponse {
  success?: boolean;
  error?: string;
}

export async function deleteMeetingById(id: string): Promise<void> {
  const response = await fetch(`/api/meetings/${id}`, {
    method: "DELETE",
  });
  const body = await parseJson<MeetingDeleteResponse>(response).catch(
    (): MeetingDeleteResponse => ({})
  );

  if (!response.ok || !body.success) {
    throw new Error(
      normalizeError(body.error, "Erro ao excluir reuniao.")
    );
  }
}
