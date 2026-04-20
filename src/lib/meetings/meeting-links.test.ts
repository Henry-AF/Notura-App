import { describe, expect, it } from "vitest";
import {
  getMeetingDetailButtonParameter,
  getMeetingDetailPath,
  getMeetingDetailUrl,
} from "./meeting-links";

describe("meeting-links", () => {
  it("builds the dynamic button parameter from the meeting id", () => {
    expect(getMeetingDetailButtonParameter("abc-123")).toBe("abc-123");
  });

  it("builds the relative dashboard path for a meeting", () => {
    expect(getMeetingDetailPath("abc-123")).toBe("dashboard/meetings/abc-123");
  });

  it("builds the absolute meeting detail URL from NEXT_PUBLIC_APP_URL", () => {
    const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.notura.com/";

    try {
      expect(getMeetingDetailUrl("abc-123")).toBe(
        "https://app.notura.com/dashboard/meetings/abc-123"
      );
    } finally {
      process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
    }
  });
});
