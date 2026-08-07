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
  it("joins multiple class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("ignores falsy values", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });

  it("resolves conflicting tailwind classes keeping the last one", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("returns an empty string when called without arguments", () => {
    expect(cn()).toBe("");
  });
});

describe("formatDate", () => {
  it("formats an ISO date in pt-BR", () => {
    const result = formatDate("2026-01-15T12:00:00Z");
    expect(result).toContain("15");
    expect(result).toContain("2026");
  });

  it("returns an em dash for null", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("returns an em dash for an empty string", () => {
    expect(formatDate("")).toBe("—");
  });

  it("returns the original string when the date is invalid", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
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

describe("formatRelativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'hoje' for today's date-only string", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T15:00:00"));
    expect(formatRelativeTime("2026-08-07")).toBe("hoje");
  });

  it("returns 'ontem' for yesterday's date-only string", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T15:00:00"));
    expect(formatRelativeTime("2026-08-06")).toBe("ontem");
  });

  it("returns days ago for a recent date-only string", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T15:00:00"));
    expect(formatRelativeTime("2026-08-03")).toBe("4d atrás");
  });

  it("falls back to a formatted date for date-only strings older than a week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T15:00:00"));
    expect(formatRelativeTime("2026-07-01")).toBe(formatDate("2026-07-01"));
  });

  it("returns 'agora' for timestamps less than a minute old", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T15:00:00"));
    expect(formatRelativeTime("2026-08-07T14:59:30")).toBe("agora");
  });

  it("returns minutes ago for timestamps under an hour old", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T15:00:00"));
    expect(formatRelativeTime("2026-08-07T14:55:00")).toBe("5 min atrás");
  });

  it("returns hours ago for timestamps under a day old", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T15:00:00"));
    expect(formatRelativeTime("2026-08-07T12:00:00")).toBe("3h atrás");
  });

  it("returns days ago for timestamps under a week old", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T15:00:00"));
    expect(formatRelativeTime("2026-08-05T15:00:00")).toBe("2d atrás");
  });

  it("falls back to a formatted date for timestamps older than a week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T15:00:00"));
    const old = "2026-06-01T15:00:00";
    expect(formatRelativeTime(old)).toBe(formatDate(old));
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
