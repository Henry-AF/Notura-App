import { describe, expect, it, vi } from "vitest";
import {
  formatRecordingDuration,
  getPreferredRecordingMimeType,
} from "./recording-session";

describe("recording session helpers", () => {
  it("prefers mp4-compatible mime types before webm fallbacks", () => {
    const supports = vi.fn((mimeType: string) => mimeType === "video/mp4");

    expect(getPreferredRecordingMimeType(supports)).toBe("video/mp4");
    expect(supports).toHaveBeenNthCalledWith(1, "audio/mp4");
    expect(supports).toHaveBeenNthCalledWith(2, "video/mp4");
  });

  it("formats elapsed recording time in a compact clock format", () => {
    expect(formatRecordingDuration(9)).toBe("00:09");
    expect(formatRecordingDuration(125)).toBe("02:05");
    expect(formatRecordingDuration(3723)).toBe("01:02:03");
  });
});
