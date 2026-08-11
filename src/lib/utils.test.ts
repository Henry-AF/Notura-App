import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cn,
  formatDate,
  formatDuration,
  formatPhone,
  formatRelativeTime,
  getInitials,
  normalizeBrazilianPhone,
} from "./utils";

describe("cn", () => {
  it("joins class names and ignores falsy values", () => {
    expect(cn("px-2", false, undefined, null, "py-1")).toBe("px-2 py-1");
  });

  it("keeps the last conflicting Tailwind class", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("returns an empty string without class names", () => {
    expect(cn()).toBe("");
  });
});

describe("formatDate", () => {
  it("formats an ISO timestamp in pt-BR", () => {
    expect(formatDate("2026-01-15T12:00:00Z")).toBe("15 de jan. de 2026");
  });

  it.each([null, ""])("returns an em dash for %s", (date) => {
    expect(formatDate(date)).toBe("—");
  });

  it("returns the original value for an invalid date", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });
});

describe("formatRelativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["2026-08-07", "hoje"],
    ["2026-08-06", "ontem"],
    ["2026-08-03", "4d atrás"],
  ])("formats the date-only value %s as %s", (date, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 7, 15));

    expect(formatRelativeTime(date)).toBe(expected);
  });

  it("formats date-only values older than one week as dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 7, 15));

    expect(formatRelativeTime("2026-07-01")).toBe(formatDate("2026-07-01"));
  });

  it.each([
    ["2026-08-07T14:59:30", "agora"],
    ["2026-08-07T14:55:00", "5 min atrás"],
    ["2026-08-07T12:00:00", "3h atrás"],
    ["2026-08-05T15:00:00", "2d atrás"],
  ])("formats the timestamp %s as %s", (date, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 7, 15));

    expect(formatRelativeTime(date)).toBe(expected);
  });

  it("formats timestamps older than one week as dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 7, 15));
    const oldTimestamp = "2026-06-01T15:00:00";

    expect(formatRelativeTime(oldTimestamp)).toBe(formatDate(oldTimestamp));
  });
});

describe("formatDuration", () => {
  it("returns an em dash for null", () => {
    expect(formatDuration(null)).toBe("—");
  });

  it("returns an em dash for zero", () => {
    expect(formatDuration(0)).toBe("—");
  });

  it("formats durations under one minute as 0 min", () => {
    expect(formatDuration(59)).toBe("0 min");
  });

  it("formats durations under one hour in minutes", () => {
    expect(formatDuration(60)).toBe("1 min");
    expect(formatDuration(3599)).toBe("59 min");
  });

  it("formats durations of one hour or more as hours and minutes", () => {
    expect(formatDuration(3600)).toBe("1h 0min");
    expect(formatDuration(3661)).toBe("1h 1min");
    expect(formatDuration(7320)).toBe("2h 2min");
  });
});

describe("getInitials", () => {
  it("returns '?' for null", () => {
    expect(getInitials(null)).toBe("?");
  });

  it("returns '?' for an empty string", () => {
    expect(getInitials("")).toBe("?");
  });

  it("returns the first letter for a single name", () => {
    expect(getInitials("Henry")).toBe("H");
  });

  it("returns the first two initials uppercased", () => {
    expect(getInitials("henry fama")).toBe("HF");
  });

  it("keeps only the first two initials for longer names", () => {
    expect(getInitials("Ana Beatriz Costa")).toBe("AB");
  });
});

describe("normalizeBrazilianPhone", () => {
  it("strips non-digit characters", () => {
    expect(normalizeBrazilianPhone("+55 (11) 98765-4321")).toBe(
      "5511987654321",
    );
  });

  it("adds the 55 country code to an 11-digit number", () => {
    expect(normalizeBrazilianPhone("11987654321")).toBe("5511987654321");
  });

  it("adds the 55 country code to a 10-digit number", () => {
    expect(normalizeBrazilianPhone("1133334444")).toBe("551133334444");
  });

  it("keeps numbers already prefixed with 55", () => {
    expect(normalizeBrazilianPhone("5511987654321")).toBe("5511987654321");
    expect(normalizeBrazilianPhone("551133334444")).toBe("551133334444");
  });

  it("returns the digits unchanged for other lengths", () => {
    expect(normalizeBrazilianPhone("12345")).toBe("12345");
  });

  it("returns an empty string for empty input", () => {
    expect(normalizeBrazilianPhone("")).toBe("");
  });
});

describe("formatPhone", () => {
  it("formats a 13-digit number starting with 55", () => {
    expect(formatPhone("5511987654321")).toBe("+55 (11) 98765-4321");
  });

  it("strips non-digit characters before formatting", () => {
    expect(formatPhone("55 11 98765-4321")).toBe("+55 (11) 98765-4321");
  });

  it("returns the input unchanged when it does not match the expected format", () => {
    expect(formatPhone("11987654321")).toBe("11987654321");
    expect(formatPhone("+1 555 123 4567")).toBe("+1 555 123 4567");
  });

  it("returns an empty string for empty input", () => {
    expect(formatPhone("")).toBe("");
  });
});
