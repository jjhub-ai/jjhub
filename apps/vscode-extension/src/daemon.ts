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
      const terminal = vscode.window.createTerminal({
        name: "JJHub Daemon",
        hideFromUser: true,
      });
      terminal.sendText("jjhub daemon start", true);

      // Give the daemon a moment to start, then verify.
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const alive = await this.isRunning();
      this.setStatus(alive ? "running" : "error");

      if (!alive) {
        vscode.window.showWarningMessage(
          "JJHub daemon did not start. Run `jjhub daemon start` manually.",
        );
      }
    } catch {
      this.setStatus("error");
    }
  }

  /** Start polling daemon health at an interval. */
  startPolling(intervalMs = 15_000): void {
    this.stopPolling();
    this.pollTimer = setInterval(async () => {
      const alive = await this.isRunning();
      this.setStatus(alive ? "running" : "stopped");
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
