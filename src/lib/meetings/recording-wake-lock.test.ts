import { describe, expect, it, vi } from "vitest";
import { acquireRecordingWakeLock } from "./recording-wake-lock";

describe("acquireRecordingWakeLock", () => {
  it("uses the browser Wake Lock API when available", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release });
    const documentRef = createDocumentRef();

    const lock = await acquireRecordingWakeLock({
      wakeLock: { request },
      document: documentRef,
      createNoSleep: () => {
        throw new Error("NoSleep fallback should not be used");
      },
    });

    expect(request).toHaveBeenCalledWith("screen");
    expect(documentRef.addEventListener).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );

    await lock.release();

    expect(release).toHaveBeenCalledTimes(1);
    expect(documentRef.removeEventListener).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );
  });

  it("falls back to NoSleep when Wake Lock API is unavailable", async () => {
    const enable = vi.fn().mockResolvedValue(undefined);
    const disable = vi.fn();

    const lock = await acquireRecordingWakeLock({
      wakeLock: undefined,
      document: createDocumentRef(),
      createNoSleep: () => ({ enable, disable }),
    });

    expect(enable).toHaveBeenCalledTimes(1);

    await lock.release();

    expect(disable).toHaveBeenCalledTimes(1);
  });

  it("reacquires native wake lock when the page becomes visible again", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release });
    const documentRef = createDocumentRef();

    const lock = await acquireRecordingWakeLock({
      wakeLock: { request },
      document: documentRef,
      createNoSleep: () => {
        throw new Error("NoSleep fallback should not be used");
      },
    });

    documentRef.visibilityState = "visible";
    await documentRef.dispatchVisibilityChange();

    expect(request).toHaveBeenCalledTimes(2);

    await lock.release();
  });
});

function createDocumentRef() {
  let visibilityChange: (() => void) | null = null;

  return {
    visibilityState: "visible",
    addEventListener: vi.fn((event: string, listener: EventListener) => {
      if (event === "visibilitychange") {
        visibilityChange = () => listener(new Event("visibilitychange"));
      }
    }),
    removeEventListener: vi.fn(),
    async dispatchVisibilityChange() {
      visibilityChange?.();
      await Promise.resolve();
    },
  };
}
