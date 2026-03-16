/**
 * Preload script injected into the ElectroBun webview.
 *
 * Sets a global flag that the SolidJS app reads at startup to decide whether
 * to use IPC transport (direct in-process calls to the Hono server) instead
 * of HTTP fetch.
 *
 * The flag is checked in @jjhub/ui-core's client.ts initialization path.
 */

declare global {
  interface Window {
    __JJHUB_TRANSPORT?: "ipc" | "http";
  }
}

window.__JJHUB_TRANSPORT = "ipc";
