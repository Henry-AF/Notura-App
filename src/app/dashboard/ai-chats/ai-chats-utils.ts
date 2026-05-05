export function filterAiChatsByMeeting<T extends { meetingId: string }>(
  chats: T[],
  meetingId: string
): T[] {
  if (meetingId === "all") return chats;
  return chats.filter((chat) => chat.meetingId === meetingId);
}
