import {
  fetchMeetingUploadDefaults,
  initMeetingUpload,
  processUploadedMeeting,
} from "@/lib/meetings/meeting-upload-client";
import { uploadFileToSignedUrl } from "@/lib/meetings/upload-client";

export interface RecordingDefaults {
  accountWhatsappNumber: string;
  meetingGroups: import("@/lib/meeting-groups-client").MeetingGroupOption[];
}

export interface SubmitRecordedMeetingInput {
  whatsappNumber: string;
  recording: Blob;
  recordedAt?: Date;
  groupId?: string | null;
  onUploadProgress?: (pct: number) => void;
}

let inFlightSubmission: Promise<string> | null = null;

function formatDateToYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateToFileSegment(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join("-");
}

function getRecordedFileMetadata(recording: Blob, recordedAt: Date) {
  const contentType = recording.type || "video/mp4";
  const extension = contentType.includes("mp4") ? "mp4" : "webm";
  const fileName = `recording-${formatDateToFileSegment(recordedAt)}.${extension}`;
  const file = new File([recording], fileName, { type: contentType });

  return { file, fileName, contentType };
}

export async function fetchRecordingDefaults(): Promise<RecordingDefaults> {
  return await fetchMeetingUploadDefaults();
}

export async function submitRecordedMeeting(
  input: SubmitRecordedMeetingInput
): Promise<string> {
  if (inFlightSubmission) {
    return await inFlightSubmission;
  }

  inFlightSubmission = (async () => {
    const recordedAt = input.recordedAt ?? new Date();
    const { file, fileName, contentType } = getRecordedFileMetadata(
      input.recording,
      recordedAt
    );
    const { r2Key, uploadUrl, uploadToken } = await initMeetingUpload({
      fileName,
      contentType,
      fileSize: file.size,
    });

    await uploadFileToSignedUrl(
      uploadUrl,
      file,
      contentType,
      input.onUploadProgress
    );

    return await processUploadedMeeting({
      meetingDate: formatDateToYmd(recordedAt),
      whatsappNumber: input.whatsappNumber,
      r2Key,
      uploadToken,
      groupId: input.groupId,
    });
  })();

  try {
    return await inFlightSubmission;
  } finally {
    inFlightSubmission = null;
  }
}
