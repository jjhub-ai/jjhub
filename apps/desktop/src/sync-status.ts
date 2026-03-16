/**
 * Sync status management for the JJHub desktop app.
 *
 * Periodically checks whether the remote JJHub instance is reachable,
 * tracks pending sync queue items, recent repos, and notification counts.
 * Exposes the current state for the system tray menu.
 */

export enum SyncStatus {
  Online = "online",
  Offline = "offline",
  Syncing = "syncing",
  Error = "error",
}

export interface RecentRepo {
  /** Full name, e.g. "owner/repo" */
  fullName: string;
  /** Timestamp of last access */
  lastAccessed: Date;
}

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  unreadNotifications: number;
  recentRepos: RecentRepo[];
  lastChecked: Date | null;
  lastError: string | null;
}

export type SyncStatusCallback = (state: Readonly<SyncState>) => void;

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

const state: SyncState = {
  status: SyncStatus.Offline,
  pendingCount: 0,
  unreadNotifications: 0,
  recentRepos: [],
  lastChecked: null,
  lastError: null,
};

let pollTimer: ReturnType<typeof setInterval> | null = null;
let callback: SyncStatusCallback | null = null;
let daemonBaseUrl = "http://localhost:4000";

const POLL_INTERVAL_MS = 10_000; // 10 seconds

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Return the full current sync state (read-only snapshot). */
export function currentState(): Readonly<SyncState> {
  return { ...state, recentRepos: [...state.recentRepos] };
}

/** Return the current sync status. */
export function currentStatus(): SyncStatus {
  return state.status;
}

/** Return the number of items waiting to sync. */
export function pendingCount(): number {
  return state.pendingCount;
}

/** Return the number of unread notifications. */
export function unreadNotificationCount(): number {
  return state.unreadNotifications;
}

/** Human-readable label for the tray menu. */
export function getSyncStatusLabel(status: SyncStatus, pending: number): string {
  switch (status) {
    case SyncStatus.Online:
      return pending > 0
        ? `Sync Status: Online (${pending} pending)`
        : "Sync Status: Online";
    case SyncStatus.Syncing:
      return "Sync Status: Syncing...";
    case SyncStatus.Offline:
      return "Sync Status: Offline";
    case SyncStatus.Error:
      return "Sync Status: Error";
  }
}

/** Start the periodic sync monitor. */
export function startSyncMonitor(
  daemonUrl: string,
  onStatusChange: SyncStatusCallback,
): void {
  daemonBaseUrl = daemonUrl;
  callback = onStatusChange;

  // Run an initial check immediately
  checkSync(daemonUrl);

  pollTimer = setInterval(() => {
    checkSync(daemonUrl);
  }, POLL_INTERVAL_MS);
}

/** Stop the periodic sync monitor. */
export function stopSyncMonitor(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  callback = null;
}

/** Trigger an immediate sync attempt. */
export function forceSyncNow(): void {
  const prev = state.status;
  state.status = SyncStatus.Syncing;
  notify();

  // The actual sync is handled by the daemon — we just hit the endpoint.
  // After a short delay, the next poll cycle will pick up the real status.
  fetch(`${daemonBaseUrl}/api/v1/sync`, { method: "POST" })
    .then(() => {
      state.status = SyncStatus.Online;
      notify();
    })
    .catch(() => {
      state.status = prev;
      notify();
    });
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function checkSync(daemonUrl: string): Promise<void> {
  try {
    // Health check against the local daemon
    const res = await fetch(`${daemonUrl}/api/v1/health`, {
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      updateState(SyncStatus.Error, 0, `Health check returned ${res.status}`);
      return;
    }

    const body = (await res.json()) as {
      status?: string;
      pendingSyncCount?: number;
      unreadNotifications?: number;
      recentRepos?: Array<{ fullName: string; lastAccessed: string }>;
    };

    const pending = body.pendingSyncCount ?? 0;
    const unread = body.unreadNotifications ?? state.unreadNotifications;
    const newStatus = pending > 0 ? SyncStatus.Syncing : SyncStatus.Online;

    // Update recent repos if provided by the health endpoint
    if (body.recentRepos) {
      state.recentRepos = body.recentRepos.map((r) => ({
        fullName: r.fullName,
        lastAccessed: new Date(r.lastAccessed),
      }));
    }

    state.unreadNotifications = unread;
    updateState(newStatus, pending, null);
  } catch (err) {
    updateState(SyncStatus.Offline, 0, String(err));
  }
}

function updateState(
  status: SyncStatus,
  pending: number,
  error: string | null,
): void {
  const changed =
    state.status !== status ||
    state.pendingCount !== pending;

  state.status = status;
  state.pendingCount = pending;
  state.lastChecked = new Date();
  state.lastError = error;

  if (changed) {
    notify();
  }
}

function notify(): void {
  if (callback) {
    callback(state);
  }
}
