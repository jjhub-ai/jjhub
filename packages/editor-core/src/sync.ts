/**
 * Sync status monitoring for JJHub editor integrations.
 *
 * Provides types and utilities for tracking the daemon's synchronization
 * state with the remote JJHub server.
 */

/** Possible sync states for the daemon. */
export type SyncStatus = "online" | "offline" | "syncing" | "error";

export type SyncStatusInfo = {
  status: SyncStatus;
  last_sync_at: string | null;
  pending_count: number;
  error_message?: string;
};

/**
 * Poll the daemon's sync status endpoint periodically.
 *
 * Returns a cleanup function that stops polling when called.
 *
 * @param url - The daemon base URL (e.g. "http://localhost:4000")
 * @param callback - Called with the latest sync status on each poll
 * @param intervalMs - Polling interval in milliseconds (default: 5000)
 * @returns A function to stop polling
 */
export function pollSyncStatus(
  url: string,
  callback: (status: SyncStatusInfo) => void,
  intervalMs = 5_000,
): () => void {
  let stopped = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  async function poll() {
    if (stopped) return;

    try {
      const res = await fetch(`${url}/api/sync/status`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = (await res.json()) as SyncStatusInfo;
        if (!stopped) callback(data);
      } else {
        if (!stopped) {
          callback({
            status: "error",
            last_sync_at: null,
            pending_count: 0,
            error_message: `HTTP ${res.status}`,
          });
        }
      }
    } catch {
      if (!stopped) {
        callback({
          status: "offline",
          last_sync_at: null,
          pending_count: 0,
        });
      }
    }

    if (!stopped) {
      timeoutId = setTimeout(poll, intervalMs);
    }
  }

  // Start the first poll immediately
  poll();

  return () => {
    stopped = true;
    if (timeoutId != null) clearTimeout(timeoutId);
  };
}

/**
 * Get the number of items pending sync with the remote.
 *
 * @param url - The daemon base URL (e.g. "http://localhost:4000")
 * @returns The pending sync count, or 0 if the daemon is unreachable
 */
export async function getPendingSyncCount(url: string): Promise<number> {
  try {
    const res = await fetch(`${url}/api/sync/status`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as SyncStatusInfo;
    return data.pending_count;
  } catch {
    return 0;
  }
}
