import { blobService } from "./service";

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_DELAY_MS = 30_000;

export interface SweeperHandle {
  stop(): void;
}

// Background job that periodically deletes blobs marked `pending_gc_at` more
// than `delayMs` ago. The delay is the cancellation window: a concurrent
// duplicate-set landing shortly after a delete cancels the mark before the
// sweeper picks it up.
export function startBlobSweeper(
  intervalMs: number = DEFAULT_INTERVAL_MS,
  delayMs: number = DEFAULT_DELAY_MS
): SweeperHandle {
  const tick = async () => {
    try {
      const cutoff = new Date(Date.now() - delayMs);
      const deleted = await blobService.sweepMarked(cutoff);
      if (deleted.length > 0) console.log("blob sweeper: deleted", deleted.length, "blob(s)");
    } catch (error) {
      console.error("blob sweeper failed:", error);
    }
  };

  const handle = setInterval(() => {
    void tick();
  }, intervalMs);

  return {
    stop() {
      clearInterval(handle);
    },
  };
}
