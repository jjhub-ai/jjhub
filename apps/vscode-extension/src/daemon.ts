import * as vscode from "vscode";
import { JJHubApiClient } from "./api";

export type DaemonStatus = "running" | "stopped" | "starting" | "error";

export class DaemonManager {
  private status: DaemonStatus = "stopped";
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private readonly onStatusChangeEmitter = new vscode.EventEmitter<DaemonStatus>();
  public readonly onStatusChange = this.onStatusChangeEmitter.event;

  constructor(private readonly api: JJHubApiClient) {}

  getStatus(): DaemonStatus {
    return this.status;
  }

  /** Check if the daemon is reachable right now. */
  async isRunning(): Promise<boolean> {
    try {
      return await this.api.healthCheck();
    } catch {
      return false;
    }
  }

  /**
   * Auto-start the daemon if the user has `jjhub.autoStartDaemon` enabled.
   * Falls back gracefully if the daemon binary isn't found.
   */
  async autoStart(): Promise<void> {
    const config = vscode.workspace.getConfiguration("jjhub");
    if (!config.get<boolean>("autoStartDaemon", true)) {
      return;
    }

    const running = await this.isRunning();
    if (running) {
      this.setStatus("running");
      return;
    }

    this.setStatus("starting");

    try {
      // Check if jjhub CLI is available before trying to spawn
      const binaryPath = await this.findBinary();
      if (!binaryPath) {
        this.setStatus("error");
        const action = await vscode.window.showWarningMessage(
          "JJHub CLI not found. Install it to enable daemon auto-start.",
          "Install Instructions",
        );
        if (action === "Install Instructions") {
          vscode.env.openExternal(
            vscode.Uri.parse("https://jjhub.tech/docs/cli/install"),
          );
        }
        return;
      }

      const terminal = vscode.window.createTerminal({
        name: "JJHub Daemon",
        hideFromUser: true,
      });
      terminal.sendText(`${binaryPath} daemon start`, true);

      // Poll health endpoint for up to 15 seconds
      const started = await this.waitForHealth(15_000, 500);
      this.setStatus(started ? "running" : "error");

      if (started) {
        vscode.window.showInformationMessage("JJHub daemon started");
      } else {
        vscode.window.showWarningMessage(
          "JJHub daemon did not start within 15 seconds. Run `jjhub daemon start` manually.",
        );
      }
    } catch {
      this.setStatus("error");
      vscode.window.showWarningMessage(
        "JJHub daemon failed to start. Run `jjhub daemon start` manually.",
      );
    }
  }

  /**
   * Poll the health endpoint until the daemon responds or the timeout is reached.
   */
  private async waitForHealth(
    timeoutMs: number,
    intervalMs: number,
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const alive = await this.isRunning();
      if (alive) return true;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    return false;
  }

  /**
   * Try to locate the jjhub binary. Returns the path if found, null otherwise.
   * Checks PATH via `which` (or `where` on Windows).
   */
  private async findBinary(): Promise<string | null> {
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);

    const cmd = process.platform === "win32" ? "where jjhub" : "which jjhub";

    try {
      const { stdout } = await execAsync(cmd);
      const result = stdout.trim().split("\n")[0]?.trim();
      return result || null;
    } catch {
      return null;
    }
  }

  /** Start polling daemon health at an interval. */
  startPolling(intervalMs = 10_000): void {
    this.stopPolling();
    this.pollTimer = setInterval(async () => {
      const prev = this.status;
      const alive = await this.isRunning();
      this.setStatus(alive ? "running" : "stopped");

      // Notify on state transitions
      if (prev === "running" && !alive) {
        vscode.window.showWarningMessage("JJHub daemon went offline.");
      } else if (prev !== "running" && prev !== "starting" && alive) {
        vscode.window.showInformationMessage("JJHub daemon is now online.");
      }
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  private setStatus(next: DaemonStatus): void {
    if (next !== this.status) {
      this.status = next;
      this.onStatusChangeEmitter.fire(next);
    }
  }

  dispose(): void {
    this.stopPolling();
    this.onStatusChangeEmitter.dispose();
  }
}
