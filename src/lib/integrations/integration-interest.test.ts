import { describe, expect, it } from "vitest";
import {
  INTEGRATION_CHANNELS,
  isIntegrationChannel,
} from "./integration-interest";

describe("isIntegrationChannel", () => {
  it.each(INTEGRATION_CHANNELS)("returns true for valid channel %s", (channel) => {
    expect(isIntegrationChannel(channel)).toBe(true);
  });

  it("returns false for an unknown string", () => {
    expect(isIntegrationChannel("slack")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isIntegrationChannel("")).toBe(false);
  });

  it("returns false for a number", () => {
    expect(isIntegrationChannel(1)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isIntegrationChannel(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isIntegrationChannel(undefined)).toBe(false);
  });

  it("returns false for an object", () => {
    expect(isIntegrationChannel({ channel: "zoom" })).toBe(false);
  });

  it("returns false for an array", () => {
    expect(isIntegrationChannel(["zoom"])).toBe(false);
  });
});
