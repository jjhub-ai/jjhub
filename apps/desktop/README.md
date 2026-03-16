# @jjhub/desktop

Native desktop application for JJHub, built with [ElectroBun](https://electrobun.dev). Bundles the JJHub daemon and web UI into a single native app with system tray integration.

## What it does

- Starts the JJHub daemon in-process using PGLite (embedded Postgres)
- Opens a native webview window pointing at the daemon's web UI
- Provides a system tray icon with sync status, force-sync, and quick access

No Chromium bundle -- uses the system webview for a ~14MB app size.

## Prerequisites

- [Bun](https://bun.sh) installed
- Platform build tools:
  - **macOS**: Xcode command line tools + cmake
  - **Windows**: Visual Studio Build Tools + cmake
  - **Linux**: build-essential, cmake, webkit2gtk, GTK3

## Development

```bash
# From the repo root, install dependencies
pnpm install

# Run in dev mode with hot reload
cd apps/desktop
bun run dev
```

## Build

```bash
# Production build
bun run build

# Canary build
bun run build:canary
```

Output is a self-contained native app bundle:
- **macOS**: `JJHub.app`
- **Windows**: `JJHub.exe` installer
- **Linux**: AppImage or deb

## Architecture

```
apps/desktop/
  src/
    bun/
      index.ts          -- Main process: starts daemon, creates window + tray
    sync-status.ts      -- Sync state monitor (online/offline/syncing/error)
    mainview/
      index.html        -- Loading screen (shown briefly during boot)
      index.css
      index.ts
  assets/               -- App icons and tray icons
  electrobun.config.ts  -- ElectroBun build configuration
```

The main process (`src/bun/index.ts`) does three things on startup:

1. Sets `JJHUB_DB_MODE=pglite` and `JJHUB_PORT=4000`
2. Dynamically imports `@jjhub/server` to boot the Hono-based daemon
3. Creates a `BrowserWindow` pointing at `http://localhost:4000`

A `Tray` icon is created with a context menu showing sync status. The sync
monitor polls the daemon's health endpoint every 10 seconds and updates the
tray menu accordingly.

Closing the window hides to tray (the app keeps running). Selecting "Quit"
from the tray menu triggers a graceful shutdown that stops the sync monitor,
removes the tray icon, and shuts down the daemon before exiting.
