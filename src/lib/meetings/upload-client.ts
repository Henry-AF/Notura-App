export {
  initMeetingUpload,
  processUploadedMeeting,
} from "@/app/dashboard/new/new-api";

export function uploadFileToSignedUrl(
  uploadUrl: string,
  file: Blob,
  contentType: string,
  onProgress?: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);

    if (contentType) {
      xhr.setRequestHeader("Content-Type", contentType);
    }

    xhr.upload.addEventListener("progress", (event) => {
      if (!onProgress || !event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      reject(new Error(`Erro ${xhr.status} ao enviar arquivo para storage.`));
    });

    xhr.addEventListener("error", () =>
      reject(new Error("Falha na conexão durante upload do arquivo."))
    );
    xhr.addEventListener("abort", () =>
      reject(new Error("Upload cancelado."))
    );

    xhr.send(file);
  });
}
