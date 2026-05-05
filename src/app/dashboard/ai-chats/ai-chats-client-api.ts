import { normalizeError, parseJson } from "@/lib/api-client";

interface DeleteAiChatResponse {
  success?: boolean;
  error?: string;
}

export async function deleteAiChat(chatId: string): Promise<void> {
  const response = await fetch(`/api/meeting-chats/${chatId}`, {
    method: "DELETE",
  });
  const body = await parseJson<DeleteAiChatResponse>(response).catch(
    (): DeleteAiChatResponse => ({})
  );

  if (!response.ok || !body.success) {
    throw new Error(normalizeError(body.error, "Erro ao excluir chat."));
  }
}
