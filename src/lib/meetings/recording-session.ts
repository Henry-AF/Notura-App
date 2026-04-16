const RECORDING_MIME_CANDIDATES = [
  "audio/mp4",
  "video/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
] as const;

export function getPreferredRecordingMimeType(
  supportsMimeType: (mimeType: string) => boolean
): string {
  for (const mimeType of RECORDING_MIME_CANDIDATES) {
    if (supportsMimeType(mimeType)) {
      return mimeType;
    }
  }

  return "";
}

export function formatRecordingDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}
