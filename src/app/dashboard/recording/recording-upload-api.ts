import {
  initMeetingUpload,
  processUploadedMeeting,
} from "@/lib/meetings/meeting-upload-client";
import { uploadFileToSignedUrl } from "@/lib/meetings/upload-client";

export interface SubmitUploadedMeetingInput {
  clientName: string;
  meetingDate: string;
  whatsappNumber: string;
  file: File;
  groupId?: string | null;
  onUploadProgress?: (pct: number) => void;
}

let inFlightSubmission: Promise<string> | null = null;

export async function submitUploadedMeeting(
  input: SubmitUploadedMeetingInput
): Promise<string> {
  if (inFlightSubmission) {
    return await inFlightSubmission;
  }

  inFlightSubmission = (async () => {
    const { r2Key, uploadUrl, uploadToken } = await initMeetingUpload({
      fileName: input.file.name,
      contentType: input.file.type,
      fileSize: input.file.size,
    });

    await uploadFileToSignedUrl(
      uploadUrl,
      input.file,
      input.file.type,
      input.onUploadProgress
    );

    return await processUploadedMeeting({
      clientName: input.clientName,
      meetingDate: input.meetingDate,
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
