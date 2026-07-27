import { normalizeMeteringDb, smoothAmplitude } from './metering';

describe('normalizeMeteringDb', () => {
  it('returns 0 for null input (metering unavailable)', () => {
    expect(normalizeMeteringDb(null)).toBe(0);
  });

  it('clamps to 0 at or below the silence floor', () => {
    expect(normalizeMeteringDb(-60)).toBe(0);
    expect(normalizeMeteringDb(-160)).toBe(0);
  });

  it('clamps to 1 at or above 0dB', () => {
    expect(normalizeMeteringDb(0)).toBe(1);
    expect(normalizeMeteringDb(6)).toBe(1);
  });

  it('maps a mid-range reading proportionally between the floor and 0dB', () => {
    expect(normalizeMeteringDb(-30)).toBeCloseTo(0.5);
  });

  it('honors a custom minDb floor', () => {
    expect(normalizeMeteringDb(-40, { minDb: -80 })).toBeCloseTo(0.5);
    expect(normalizeMeteringDb(-80, { minDb: -80 })).toBe(0);
  });
});

describe('smoothAmplitude', () => {
  it('applies the next value instantly when smoothing is 1', () => {
    expect(smoothAmplitude(0.2, 0.9, 1)).toBe(0.9);
  });

  it('leaves the previous value unchanged when smoothing is 0', () => {
    expect(smoothAmplitude(0.2, 0.9, 0)).toBe(0.2);
  });

  it('converges toward the next value over repeated frames', () => {
    let value = 0;
    for (let i = 0; i < 50; i += 1) {
      value = smoothAmplitude(value, 1, 0.3);
    }
    expect(value).toBeCloseTo(1, 3);
  });

  it('moves partway toward next for an intermediate smoothing factor', () => {
    expect(smoothAmplitude(0, 1, 0.25)).toBeCloseTo(0.25);
  });
});
