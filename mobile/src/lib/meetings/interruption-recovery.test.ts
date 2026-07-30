import { createAutoResumeScheduler } from './interruption-recovery';

describe('createAutoResumeScheduler', () => {
  it('allows an immediate first attempt', () => {
    const scheduler = createAutoResumeScheduler([500, 1000]);
    expect(scheduler.shouldAttempt(0)).toBe(true);
  });

  it('withholds the next attempt until its delay has elapsed', () => {
    const scheduler = createAutoResumeScheduler([500, 1000]);
    scheduler.recordAttempt(0);

    expect(scheduler.shouldAttempt(300)).toBe(false);
    expect(scheduler.shouldAttempt(500)).toBe(true);
  });

  it('uses the delay matching the attempt count, not a fixed interval', () => {
    const scheduler = createAutoResumeScheduler([500, 1000, 2000]);
    scheduler.recordAttempt(0);
    scheduler.recordAttempt(500);

    expect(scheduler.shouldAttempt(1000)).toBe(false);
    expect(scheduler.shouldAttempt(1500)).toBe(true);
  });

  it('gives up once every configured delay has been used', () => {
    const scheduler = createAutoResumeScheduler([500, 1000]);
    scheduler.recordAttempt(0);
    scheduler.recordAttempt(500);

    expect(scheduler.hasGivenUp()).toBe(true);
    expect(scheduler.shouldAttempt(999_999)).toBe(false);
  });

  it('resets back to the initial state', () => {
    const scheduler = createAutoResumeScheduler([500, 1000]);
    scheduler.recordAttempt(0);
    scheduler.recordAttempt(500);
    expect(scheduler.hasGivenUp()).toBe(true);

    scheduler.reset();

    expect(scheduler.hasGivenUp()).toBe(false);
    expect(scheduler.attemptCount).toBe(0);
    expect(scheduler.shouldAttempt(1_000_000)).toBe(true);
  });
});
