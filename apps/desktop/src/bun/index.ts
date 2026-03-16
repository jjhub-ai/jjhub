import { BrowserWindow, Tray, Utils, type MenuItemConfig } from "electrobun/bun";
import {
  SyncStatus,
  getSyncStatusLabel,
  startSyncMonitor,
  stopSyncMonitor,
  forceSyncNow,
  currentState,
  type SyncState,
} from "../sync-status";
import { configureTransport } from "@jjhub/ui-core/api/transport";

// ---------------------------------------------------------------------------
// 1. Configure the daemon to run in PGLite mode on a fixed port
// ---------------------------------------------------------------------------
process.env.JJHUB_DB_MODE = "pglite";
process.env.JJHUB_PORT = "4000";

const DAEMON_URL = "http://localhost:4000";
const APP_VERSION = "0.0.1";

// ---------------------------------------------------------------------------
// 2. Start the JJHub daemon in-process
// ---------------------------------------------------------------------------
let serverCleanup: (() => Promise<void>) | undefined;

async function startDaemon(): Promise<void> {
  try {
    // @jjhub/server exports a start function that boots the Hono server
    const server = await import("@jjhub/server");

    if (typeof server.start === "function") {
      const handle = await server.start();
      serverCleanup = handle?.stop;
    } else if (typeof server.default === "function") {
      const handle = await server.default();
      serverCleanup = handle?.stop;
    }

    console.log(`JJHub daemon running at ${DAEMON_URL}`);

    // Configure the UI transport to use IPC (direct in-process calls)
    configureTransport({ mode: "ipc" });
  } catch (err) {
    console.error("Failed to start JJHub daemon:", err);
  }
}

// ---------------------------------------------------------------------------
// 3. Create the main application window
// ---------------------------------------------------------------------------
let mainWindow: InstanceType<typeof BrowserWindow> | null = null;

// Preload script injected into every webview to signal IPC mode to the SolidJS app
const PRELOAD_SCRIPT = `window.__JJHUB_TRANSPORT = "ipc";`;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    title: "JJHub",
    url: DAEMON_URL,
    frame: {
      width: 1280,
      height: 860,
      x: 100,
      y: 100,
    },
    preload: PRELOAD_SCRIPT,
  });
}

function showWindow(): void {
  if (mainWindow) {
    try {
      mainWindow.show();
    } catch {
      createWindow();
    }
  } else {
    createWindow();
  }
}

function navigateMainWindow(path: string): void {
  if (mainWindow) {
    try {
      mainWindow.webview.loadURL(`${DAEMON_URL}${path}`);
      mainWindow.show();
    } catch {
      mainWindow = new BrowserWindow({
        title: "JJHub",
        url: `${DAEMON_URL}${path}`,
        frame: {
          width: 1280,
          height: 860,
          x: 100,
          y: 100,
        },
        preload: PRELOAD_SCRIPT,
      });
    }
  } else {
    mainWindow = new BrowserWindow({
      title: "JJHub",
      url: `${DAEMON_URL}${path}`,
      frame: {
        width: 1280,
        height: 860,
        x: 100,
        y: 100,
      },
      preload: PRELOAD_SCRIPT,
    });
  }
}

// ---------------------------------------------------------------------------
// 4. System tray — status icon and dynamic menu
// ---------------------------------------------------------------------------

/**
 * Return a tray title that reflects the sync state.
 *
 * ElectroBun's Tray uses `title` as the visible text next to the icon on
 * macOS. We use a single-character indicator so it stays compact.
 *
 * Since ElectroBun's `setImage` accepts a file path, and we may not have
 * bundled icon assets yet, we use the tray title as a lightweight status
 * indicator. Once real icon assets are added, swap to `tray.setImage(...)`.
 */
function trayTitleForStatus(status: SyncStatus, pendingCount: number): string {
  switch (status) {
    case SyncStatus.Online:
      return pendingCount > 0 ? `JJHub (${pendingCount})` : "JJHub";
    case SyncStatus.Syncing:
      return "JJHub ~";
    case SyncStatus.Offline:
    case SyncStatus.Error:
      return "JJHub !";
  }
}

const tray = new Tray({
  title: "JJHub",
});

/**
 * Build and apply the tray menu from the current sync state.
 *
 * The menu structure:
 *   "JJHub" (header, disabled)
 *   ───────
 *   Open JJHub
 *   Sync Status: ...
 *   Force Sync
 *   ───────
 *   Recent Repos ▸ (submenu)
 *   ───────
 *   Preferences...
 *   About JJHub
 *   ───────
 *   Quit JJHub
 */
function buildTrayMenu(syncState: SyncState): MenuItemConfig[] {
  const statusLabel = getSyncStatusLabel(syncState.status, syncState.pendingCount);

  // Build notification badge into the status label when there are unreads
  const notifSuffix =
    syncState.unreadNotifications > 0
      ? ` [${syncState.unreadNotifications} unread]`
      : "";

  // Recent repos submenu
  const recentRepoItems: MenuItemConfig[] =
    syncState.recentRepos.length > 0
      ? syncState.recentRepos.slice(0, 10).map((repo) => ({
          type: "normal" as const,
          label: repo.fullName,
          action: "open-repo",
          data: { fullName: repo.fullName },
        }))
      : [
          {
            type: "normal" as const,
            label: "No recent repos",
            action: "",
            enabled: false,
          },
        ];

  return [
    // Header
    {
      type: "normal",
      label: "JJHub",
      action: "",
      enabled: false,
    },
    { type: "separator" },

    // Main actions
    {
      type: "normal",
      label: "Open JJHub",
      action: "open",
    },
    {
      type: "normal",
      label: `${statusLabel}${notifSuffix}`,
      action: "status",
    },
    {
      type: "normal",
      label: "Force Sync",
      action: "force-sync",
      enabled: syncState.status !== SyncStatus.Syncing,
    },
    { type: "separator" },

    // Recent repos
    {
      type: "normal",
      label: "Recent Repos",
      action: "",
      submenu: recentRepoItems,
    },
    { type: "separator" },

    // App actions
    {
      type: "normal",
      label: "Preferences...",
      action: "preferences",
    },
    {
      type: "normal",
      label: "About JJHub",
      action: "about",
    },
    { type: "separator" },

    // Quit
    {
      type: "normal",
      label: "Quit JJHub",
      action: "quit",
    },
  ];
}

function updateTray(syncState: SyncState): void {
  tray.setTitle(trayTitleForStatus(syncState.status, syncState.pendingCount));
  tray.setMenu(buildTrayMenu(syncState));
}

// Handle tray menu clicks
tray.on("tray-clicked", (event: any) => {
  const action = event.data?.action;
  const data = event.data?.data;

  switch (action) {
    case "open":
      showWindow();
      break;

    case "status":
      navigateMainWindow("/sync");
      break;

    case "force-sync":
      forceSyncNow();
      break;

    case "open-repo": {
      const fullName = data?.fullName;
      if (fullName) {
        navigateMainWindow(`/${fullName}`);
      }
      break;
    }

    case "preferences":
      navigateMainWindow("/settings");
      break;

    case "about":
      Utils.showMessageBox({
        type: "info",
        title: "About JJHub",
        message: "JJHub Desktop",
        detail: `Version ${APP_VERSION}\n\njj-native code hosting platform\nhttps://jjhub.tech`,
        buttons: ["OK"],
      });
      break;

    case "quit":
      gracefulShutdown();
      break;

    default:
      break;
  }
});

// ---------------------------------------------------------------------------
// 5. Sync monitor integration
// ---------------------------------------------------------------------------
startSyncMonitor(DAEMON_URL, (syncState) => {
  updateTray(syncState);
});

// Set initial tray menu
updateTray(currentState());

// ---------------------------------------------------------------------------
// 6. Graceful shutdown
// ---------------------------------------------------------------------------
async function gracefulShutdown(): Promise<void> {
  console.log("Shutting down JJHub...");

  stopSyncMonitor();

  try {
    tray.remove();
  } catch {
    // tray may already be removed
  }

  if (serverCleanup) {
    try {
      await serverCleanup();
    } catch (err) {
      console.error("Error stopping daemon:", err);
    }
  }

  process.exit(0);
}

// Handle process signals for clean shutdown
process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

// ---------------------------------------------------------------------------
// 7. Boot sequence
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  await startDaemon();
  createWindow();
  console.log("JJHub desktop app started! Look for the tray icon in your menu bar.");
}

main().catch((err) => {
  console.error("Fatal error starting JJHub:", err);
  process.exit(1);
});
