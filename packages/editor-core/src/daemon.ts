/**
 * Daemon lifecycle management for JJHub editor integrations.
 *
 * Provides functions to start, stop, and health-check the local JJHub daemon
 * process that editors communicate with.
 */

import { readConfigFile } from "./config";

export type DaemonHealthResponse = {
  status: "ok" | "degraded" | "error";
  version?: string;
  uptime_seconds?: number;
};

export type StartDaemonOptions = {
  /** Port to listen on. Defaults to 4000. */
  port?: number;
  /** Additional arguments to pass to `jjhub daemon start`. */
  extraArgs?: string[];
  /** Working directory for the daemon process. */
  cwd?: string;
};

/**
 * Check if the daemon is running and healthy.
 * Returns the health response on success, or null if the daemon is unreachable.
 */
export async function checkDaemonHealth(url: string): Promise<DaemonHealthResponse | null> {
  try {
    const res = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return (await res.json()) as DaemonHealthResponse;
  } catch {
    return null;
  }
}

/**
 * Start the JJHub daemon by spawning `jjhub daemon start`.
 *
 * The process is detached so it outlives the editor. Returns the spawned
 * subprocess handle (Bun.Subprocess) so the caller can attach listeners
 * if needed.
 */
export function startDaemon(options: StartDaemonOptions = {}): ReturnType<typeof Bun.spawn> {
  const args = ["jjhub", "daemon", "start"];
  if (options.port) {
    args.push("--port", String(options.port));
  }
  if (options.extraArgs) {
    args.push(...options.extraArgs);
  }

  return Bun.spawn(args, {
    cwd: options.cwd,
    stdio: ["ignore", "ignore", "ignore"],
    // Detach so the daemon keeps running after the editor exits
    env: { ...process.env },
  });
}

/**
 * Stop the JJHub daemon by running `jjhub daemon stop`.
 */
export async function stopDaemon(): Promise<void> {
  const proc = Bun.spawn(["jjhub", "daemon", "stop"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  await proc.exited;
}

/**
 * Poll the daemon health endpoint until it responds successfully or the
 * timeout is reached.
 *
 * @param url - The daemon base URL (e.g. "http://localhost:4000")
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 10000)
 * @param intervalMs - Polling interval in milliseconds (default: 250)
 * @returns The health response once the daemon is ready
 * @throws If the timeout is reached before the daemon is healthy
 */
export async function waitForDaemon(
  url: string,
  timeoutMs = 10_000,
  intervalMs = 250,
): Promise<DaemonHealthResponse> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const health = await checkDaemonHealth(url);
    if (health) return health;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Daemon at ${url} did not become healthy within ${timeoutMs}ms`);
}

/**
 * Resolve the daemon URL from (in priority order):
 * 1. JJHUB_DAEMON_URL environment variable
 * 2. Config file (~/.config/jjhub/config.toml) daemon.url field
 * 3. Default: http://localhost:4000
 */
export function getDaemonUrl(): string {
  const envUrl = process.env["JJHUB_DAEMON_URL"];
  if (envUrl) return envUrl;

  const config = readConfigFile();
  if (config?.daemon?.url) return config.daemon.url;

  return "http://localhost:4000";
}
