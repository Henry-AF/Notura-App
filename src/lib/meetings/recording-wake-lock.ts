import NoSleep from "nosleep.js";

type WakeLockType = "screen";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

interface WakeLockLike {
  request: (type: WakeLockType) => Promise<WakeLockSentinelLike>;
}

interface WakeLockDocumentLike {
  visibilityState: DocumentVisibilityState;
  addEventListener: (
    type: "visibilitychange",
    listener: EventListener
  ) => void;
  removeEventListener: (
    type: "visibilitychange",
    listener: EventListener
  ) => void;
}

interface NoSleepLike {
  enable: () => Promise<unknown> | unknown;
  disable: () => void;
}

export interface RecordingWakeLock {
  release: () => Promise<void>;
}

export interface RecordingWakeLockDependencies {
  wakeLock?: WakeLockLike;
  document?: WakeLockDocumentLike;
  createNoSleep?: () => NoSleepLike;
}

const noopWakeLock: RecordingWakeLock = {
  release: async () => {},
};

export async function acquireRecordingWakeLock(
  dependencies: RecordingWakeLockDependencies = {}
): Promise<RecordingWakeLock> {
  const wakeLock = dependencies.wakeLock ?? getBrowserWakeLock();
  const documentRef = dependencies.document ?? getBrowserDocument();

  if (wakeLock) {
    const nativeLock = await tryAcquireNativeWakeLock(wakeLock, documentRef);
    if (nativeLock) return nativeLock;
  }

  return await tryAcquireNoSleepWakeLock(dependencies.createNoSleep);
}

async function tryAcquireNativeWakeLock(
  wakeLock: WakeLockLike,
  documentRef: WakeLockDocumentLike | undefined
): Promise<RecordingWakeLock | null> {
  let sentinel: WakeLockSentinelLike | null = null;
  let isReleased = false;

  async function requestLock() {
    if (isReleased || documentRef?.visibilityState === "hidden") return;
    sentinel = await wakeLock.request("screen");
  }

  try {
    await requestLock();
  } catch (error) {
    console.warn("[recording] Wake Lock API unavailable:", error);
    return null;
  }

  const handleVisibilityChange: EventListener = () => {
    void requestLock().catch((error) => {
      console.warn("[recording] Failed to reacquire Wake Lock:", error);
    });
  };

  documentRef?.addEventListener("visibilitychange", handleVisibilityChange);

  return {
    release: async () => {
      isReleased = true;
      documentRef?.removeEventListener("visibilitychange", handleVisibilityChange);
      await sentinel?.release();
      sentinel = null;
    },
  };
}

async function tryAcquireNoSleepWakeLock(
  createNoSleep?: () => NoSleepLike
): Promise<RecordingWakeLock> {
  const noSleep = createNoSleep ? createNoSleep() : new NoSleep();

  try {
    await noSleep.enable();
  } catch (error) {
    console.warn("[recording] NoSleep fallback unavailable:", error);
    return noopWakeLock;
  }

  return {
    release: async () => {
      noSleep.disable();
    },
  };
}

function getBrowserWakeLock(): WakeLockLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  if (!("wakeLock" in navigator)) return undefined;
  return navigator.wakeLock as unknown as WakeLockLike;
}

function getBrowserDocument(): WakeLockDocumentLike | undefined {
  if (typeof document === "undefined") return undefined;
  return document;
}
