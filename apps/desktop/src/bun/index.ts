import { BrowserWindow, Tray, Utils } from "electrobun/bun";
import { SyncStatus, getSyncStatusLabel, startSyncMonitor, stopSyncMonitor, forceSyncNow } from "../sync-status";

// ---------------------------------------------------------------------------
// 1. Configure the daemon to run in PGLite mode on a fixed port
// ---------------------------------------------------------------------------
process.env.JJHUB_DB_MODE = "pglite";
process.env.JJHUB_PORT = "4000";

const DAEMON_URL = "http://localhost:4000";

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
  } catch (err) {
    console.error("Failed to start JJHub daemon:", err);
  }
}

// ---------------------------------------------------------------------------
// 3. Create the main application window
// ---------------------------------------------------------------------------
let mainWindow: InstanceType<typeof BrowserWindow> | null = null;

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
  });
}

function showWindow(): void {
  if (mainWindow) {
    // BrowserWindow doesn't have a native show/focus yet — recreate if needed
    try {
      // Attempt to focus the existing window
      mainWindow.title = "JJHub";
    } catch {
      createWindow();
    }
  } else {
    createWindow();
  }
}

// ---------------------------------------------------------------------------
// 4. System tray with sync status
// ---------------------------------------------------------------------------
const tray = new Tray({
  title: "JJHub",
});

function updateTrayMenu(status: SyncStatus, pendingCount: number): void {
  const statusLabel = getSyncStatusLabel(status, pendingCount);

  tray.setMenu([
    { type: "normal", label: "Open JJHub", action: "open" },
    { type: "divider" },
    { type: "normal", label: statusLabel, action: "status" },
    { type: "normal", label: "Force Sync", action: "force-sync" },
    { type: "divider" },
    { type: "normal", label: "Preferences...", action: "preferences" },
    { type: "divider" },
    { type: "normal", label: "Quit JJHub", action: "quit" },
  ]);
}

// Handle tray menu clicks
tray.on("tray-clicked", (event: any) => {
  const action = event.data?.action;

  switch (action) {
    case "open":
      showWindow();
      break;

    case "force-sync":
      forceSyncNow();
      break;

    case "preferences":
      // Open the settings page in the main window
      if (mainWindow) {
        mainWindow.url = `${DAEMON_URL}/settings`;
      } else {
        mainWindow = new BrowserWindow({
          title: "JJHub - Preferences",
          url: `${DAEMON_URL}/settings`,
          frame: {
            width: 800,
            height: 600,
            x: 200,
            y: 200,
          },
        });
      }
      break;

    case "quit":
      gracefulShutdown();
      break;

    // "status" is informational — no-op
    default:
      break;
  }
});

// ---------------------------------------------------------------------------
// 5. Sync monitor integration
// ---------------------------------------------------------------------------
startSyncMonitor(DAEMON_URL, (status, pendingCount) => {
  updateTrayMenu(status, pendingCount);
});

// Set initial tray menu
updateTrayMenu(SyncStatus.Offline, 0);

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
