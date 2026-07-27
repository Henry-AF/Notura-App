import { describe, expect, it } from "vitest";
import { bucketizeFrequencyData, smoothLevels } from "./audio-level";

describe("bucketizeFrequencyData", () => {
  it("returns an empty array when barCount is zero", () => {
    expect(bucketizeFrequencyData(new Uint8Array([1, 2, 3]), 0)).toEqual([]);
  });

  it("returns zeros for every bar when there is no frequency data", () => {
    expect(bucketizeFrequencyData(new Uint8Array([]), 4)).toEqual([0, 0, 0, 0]);
  });

  it("normalizes byte values into the [0, 1] range", () => {
    const data = new Uint8Array([0, 255, 128, 64]);
    const result = bucketizeFrequencyData(data, 4);

    expect(result[0]).toBe(0);
    expect(result[1]).toBe(1);
    expect(result[2]).toBeCloseTo(128 / 255);
    expect(result[3]).toBeCloseTo(64 / 255);
  });

  it("clamps averaged values to [0, 1]", () => {
    const data = new Uint8Array([255, 255, 255, 255]);
    const result = bucketizeFrequencyData(data, 2);

    expect(result).toEqual([1, 1]);
    result.forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    });
  });

  it("buckets a larger frequency range into fewer bars by averaging", () => {
    const data = new Uint8Array([0, 0, 255, 255]);
    const result = bucketizeFrequencyData(data, 2);

    expect(result).toEqual([0, 1]);
  });

  it("produces exactly barCount values regardless of input length", () => {
    const data = new Uint8Array(100).fill(50);
    const result = bucketizeFrequencyData(data, 24);

    expect(result).toHaveLength(24);
  });
});

describe("smoothLevels", () => {
  it("returns the previous values unchanged when smoothing is zero", () => {
    const previous = [0.2, 0.4, 0.6];
    const next = [0.9, 0.9, 0.9];

    expect(smoothLevels(previous, next, 0)).toEqual(previous);
  });

  it("jumps instantly to the target values when smoothing is one", () => {
    const previous = [0.2, 0.4, 0.6];
    const next = [0.9, 0.1, 0.5];

    expect(smoothLevels(previous, next, 1)).toEqual(next);
  });

  it("moves partway toward the target for intermediate smoothing", () => {
    const previous = [0];
    const next = [1];

    expect(smoothLevels(previous, next, 0.5)).toEqual([0.5]);
  });

  it("converges toward the target value over repeated calls", () => {
    let levels = [0];
    const target = [1];

    for (let i = 0; i < 20; i += 1) {
      levels = smoothLevels(levels, target, 0.3);
    }

    expect(levels[0]).toBeGreaterThan(0.99);
  });

  it("handles empty arrays", () => {
    expect(smoothLevels([], [], 0.5)).toEqual([]);
  });
});
