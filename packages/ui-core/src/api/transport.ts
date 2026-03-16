/**
 * Transport abstraction for JJHub API calls.
 *
 * Two modes:
 *   - "http" (browser, TUI): standard fetch() to a remote URL
 *   - "ipc" (ElectroBun desktop): direct in-process call to the Hono server
 *
 * The transport is configured once at startup via `configureTransport()`.
 * All API calls flow through `transportFetch()` which dispatches based on mode.
 */

export type Transport = "http" | "ipc";

export interface TransportConfig {
  mode: Transport;
  baseUrl?: string; // for HTTP mode
  getToken?: () => string | undefined;
}

let config: TransportConfig = { mode: "http", baseUrl: "" };

/**
 * Set the transport mode and configuration.
 * Call once at app startup before any API calls.
 */
export function configureTransport(c: TransportConfig): void {
  config = c;
}

/**
 * Get the current transport configuration.
 */
export function getTransportConfig(): Readonly<TransportConfig> {
  return config;
}

/**
 * Perform a fetch using the configured transport.
 *
 * In IPC mode the request is handed directly to the in-process Hono app
 * (no network round-trip). In HTTP mode it delegates to the standard fetch API.
 */
export async function transportFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  if (config.mode === "ipc") {
    // ElectroBun IPC — call the server directly in-process.
    // The @jjhub/server default export is a Hono app with a .fetch() method.
    const { default: server } = await import("@jjhub/server");
    const url = `http://localhost${path}`;
    const request = new Request(url, init);
    return server.fetch(request);
  }

  // HTTP mode — standard fetch with optional auth header
  const url = `${config.baseUrl}${path}`;
  const headers = new Headers(init?.headers);
  const token = config.getToken?.();
  if (token) headers.set("Authorization", `token ${token}`);
  return fetch(url, { ...init, headers });
}
