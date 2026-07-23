import { downloadAsync } from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { fetchApi } from "@/lib/api/client";
import { downloadAtaFile, exportMeetingAta, shareMeetingAta } from "./export-ata";

jest.mock("@/lib/api/client", () => ({
  fetchApi: jest.fn(),
}));

jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  downloadAsync: jest.fn(),
}));

jest.mock("expo-sharing", () => ({
  shareAsync: jest.fn(),
}));

const mockedFetchApi = fetchApi as jest.Mock;
const mockedDownloadAsync = downloadAsync as jest.Mock;
const mockedShareAsync = Sharing.shareAsync as jest.Mock;

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("exportMeetingAta", () => {
  it("returns the signed URL, filename and expiration", async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({
        url: "https://r2.example.com/ata.docx?signed=1",
        filename: "ata-reuniao.docx",
        expiresIn: 3600,
      })
    );

    const result = await exportMeetingAta("meeting-1");

    expect(mockedFetchApi).toHaveBeenCalledWith("/api/meetings/meeting-1/export", {
      method: "POST",
    });
    expect(result.url).toBe("https://r2.example.com/ata.docx?signed=1");
    expect(result.filename).toBe("ata-reuniao.docx");
    expect(result.expiresIn).toBe(3600);
  });

  it("throws when the API does not return a URL", async () => {
    mockedFetchApi.mockResolvedValueOnce(mockResponse({ filename: "ata.docx" }));

    await expect(exportMeetingAta("meeting-1")).rejects.toThrow(
      "Erro ao gerar ata da reunião."
    );
  });
});

describe("downloadAtaFile", () => {
  it("downloads the file to the cache directory and returns the local URI", async () => {
    mockedDownloadAsync.mockResolvedValueOnce({
      uri: "file:///cache/ata-reuniao.docx",
      status: 200,
    });

    const result = await downloadAtaFile({
      url: "https://r2.example.com/ata.docx",
      filename: "ata-reuniao.docx",
      expiresIn: 3600,
    });

    expect(result).toBe("file:///cache/ata-reuniao.docx");
    expect(mockedDownloadAsync).toHaveBeenCalledWith(
      "https://r2.example.com/ata.docx",
      "file:///cache/ata-reuniao.docx"
    );
  });

  it("throws when the download fails", async () => {
    mockedDownloadAsync.mockResolvedValueOnce({ status: 500 });

    await expect(
      downloadAtaFile({
        url: "https://r2.example.com/ata.docx",
        filename: "ata.docx",
        expiresIn: 3600,
      })
    ).rejects.toThrow("Erro 500 ao baixar ata.");
  });
});

describe("shareMeetingAta", () => {
  it("exports, downloads and shares the file", async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({
        url: "https://r2.example.com/ata.docx",
        filename: "ata-reuniao.docx",
        expiresIn: 3600,
      })
    );
    mockedDownloadAsync.mockResolvedValueOnce({
      uri: "file:///cache/ata-reuniao.docx",
      status: 200,
    });

    await shareMeetingAta("meeting-1");

    expect(mockedShareAsync).toHaveBeenCalledWith(
      "file:///cache/ata-reuniao.docx",
      expect.objectContaining({
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
    );
  });
});
