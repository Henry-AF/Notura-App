import { describe, expect, it } from "vitest";
import { parseReferralCookieValue } from "./referral-cookie";

describe("parseReferralCookieValue", () => {
  it("parses a valid encoded payload", () => {
    const raw = encodeURIComponent(
      JSON.stringify({ code: "fulano20", clickedAt: "2026-08-12T12:00:00.000Z" })
    );
    expect(parseReferralCookieValue(raw)).toEqual({
      code: "fulano20",
      clickedAt: "2026-08-12T12:00:00.000Z",
    });
  });

  it("returns null for malformed JSON", () => {
    expect(parseReferralCookieValue("not-json")).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    const raw = encodeURIComponent(JSON.stringify({ code: "fulano20" }));
    expect(parseReferralCookieValue(raw)).toBeNull();
  });

  it("returns null when fields have the wrong type", () => {
    const raw = encodeURIComponent(JSON.stringify({ code: 123, clickedAt: "2026-08-12" }));
    expect(parseReferralCookieValue(raw)).toBeNull();
  });
});
