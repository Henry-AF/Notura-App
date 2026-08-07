import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatPhone,
  getInitials,
  normalizeBrazilianPhone,
} from "./utils";

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
