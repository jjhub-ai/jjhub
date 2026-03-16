import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { Cli, z } from "incur";
import { stateDir } from "../config.js";

/**
 * Path to the daemon PID file.
 */
function pidFilePath(): string {
  return join(stateDir(), "daemon.pid");
}

/**
 * Path to the daemon log file.
 */
function logFilePath(): string {
  return join(stateDir(), "daemon.log");
}

/**
 * Read the stored daemon PID, or null if not running.
 */
function readPid(): number | null {
  const path = pidFilePath();
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf-8").trim();
  const pid = parseInt(raw, 10);
  if (Number.isNaN(pid)) return null;

  // Check if process is actually alive
  try {
    process.kill(pid, 0);
    return pid;
  } catch {
    // Process is gone — clean up stale PID file
    try { unlinkSync(path); } catch {}
    return null;
  }
}

/**
 * Write the daemon PID file.
 */
function writePid(pid: number): void {
  const dir = stateDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(pidFilePath(), String(pid), "utf-8");
}

/**
 * Remove the daemon PID file.
 */
function removePid(): void {
  try { unlinkSync(pidFilePath()); } catch {}
}

export const daemon = Cli.create("daemon", {
  description: "Run JJHub locally with embedded PostgreSQL (PGLite)",
})
  .command("start", {
    description: "Start the local JJHub daemon with embedded PostgreSQL",
    options: z.object({
      port: z.string().default("3000").describe("Port to listen on"),
      host: z.string().default("127.0.0.1").describe("Host to bind to"),
      "data-dir": z.string().optional().describe("Data directory (default: ./data)"),
      foreground: z.boolean().default(false).describe("Run in foreground instead of daemonizing"),
    }),
    async run(c) {
      const existingPid = readPid();
      if (existingPid) {
        return {
          status: "already_running",
          pid: existingPid,
          message: `Daemon is already running (PID ${existingPid}). Use 'jjhub daemon stop' first.`,
        };
      }

      const port = c.options.port;
      const host = c.options.host;
      const dataDir = c.options["data-dir"] ?? "./data";

      // Set environment for PGLite mode
      process.env.JJHUB_DB_MODE = "pglite";
      process.env.JJHUB_DATA_DIR = dataDir;
      process.env.JJHUB_PORT = port;
      process.env.JJHUB_HOST = host;

      if (!c.options.foreground) {
        // Spawn detached daemon process
        const { spawn } = await import("node:child_process");
        const { openSync } = await import("node:fs");

        const logPath = logFilePath();
        mkdirSync(stateDir(), { recursive: true });
        const logFd = openSync(logPath, "a");

        const child = spawn(
          process.argv[0],
          [
            ...process.argv.slice(1, process.argv.indexOf("daemon")),
            "daemon", "start", "--foreground",
            "--port", port,
            "--host", host,
            "--data-dir", dataDir,
          ],
          {
            detached: true,
            stdio: ["ignore", logFd, logFd],
            env: {
              ...process.env,
              JJHUB_DB_MODE: "pglite",
              JJHUB_DATA_DIR: dataDir,
              JJHUB_PORT: port,
              JJHUB_HOST: host,
            },
          },
        );

        child.unref();
        writePid(child.pid!);

        return {
          status: "started",
          pid: child.pid,
          port,
          host,
          data_dir: dataDir,
          log: logPath,
          url: `http://${host}:${port}`,
          message: `Daemon started (PID ${child.pid}). Logs: ${logPath}`,
        };
      }

      // Foreground mode — run the server directly in this process
      writePid(process.pid);

      // Ensure data directory exists
      mkdirSync(dataDir, { recursive: true });

      console.log(`JJHub daemon starting (PGLite mode)`);
      console.log(`  Data directory: ${dataDir}`);
      console.log(`  Listening on: http://${host}:${port}`);

      // Clean up PID file on exit
      const cleanup = () => {
        removePid();
        process.exit(0);
      };
      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);

      // Import and start the server — initDb() inside will pick up JJHUB_DB_MODE=pglite
      await import("@jjhub/server");

      // Keep the process alive
      await new Promise(() => {});
    },
  })
  .command("status", {
    description: "Show daemon status",
    async run() {
      const pid = readPid();
      if (!pid) {
        return {
          status: "stopped",
          message: "Daemon is not running.",
        };
      }

      // Try to reach the daemon's health endpoint
      const config = await import("../config.js").then(m => m.loadConfig());
      const apiUrl = config.api_url ?? "http://127.0.0.1:3000";

      try {
        const res = await fetch(`${apiUrl}/api/health`);
        const body = await res.json();
        return {
          status: "running",
          pid,
          healthy: res.ok && body.status === "ok",
          url: apiUrl,
        };
      } catch {
        return {
          status: "running",
          pid,
          healthy: false,
          message: "Daemon process is alive but health check failed.",
        };
      }
    },
  })
  .command("stop", {
    description: "Stop the running daemon",
    async run() {
      const pid = readPid();
      if (!pid) {
        return {
          status: "not_running",
          message: "Daemon is not running.",
        };
      }

      try {
        process.kill(pid, "SIGTERM");
      } catch (err) {
        // Process might already be gone
        removePid();
        return {
          status: "stopped",
          pid,
          message: `Process ${pid} already gone. Cleaned up PID file.`,
        };
      }

      // Wait briefly for process to exit
      let exited = false;
      for (let i = 0; i < 30; i++) {
        try {
          process.kill(pid, 0);
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch {
          exited = true;
          break;
        }
      }

      removePid();

      if (exited) {
        return {
          status: "stopped",
          pid,
          message: `Daemon stopped (PID ${pid}).`,
        };
      }

      // Force kill if still alive
      try { process.kill(pid, "SIGKILL"); } catch {}
      return {
        status: "stopped",
        pid,
        message: `Daemon force-killed (PID ${pid}).`,
      };
    },
  });
