import * as vscode from "vscode";
import { JJHubApiClient } from "./api";
import { DaemonManager, DaemonStatus } from "./daemon";
import { detectRepo } from "./repo";

export class StatusBarManager {
  private readonly item: vscode.StatusBarItem;
  private unreadCount = 0;
  private pendingCount = 0;
  private pollTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly daemon: DaemonManager,
    private readonly api: JJHubApiClient,
  ) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100,
    );
    this.item.command = "jjhub.focusSync";
    this.item.tooltip = "Click to open JJHub sync status";

    this.daemon.onStatusChange((status) => this.render(status));
    this.render(this.daemon.getStatus());
    this.item.show();

    // Start polling daemon status and sync info every 10 seconds
    this.startPolling();
  }

  /** Update the unread notification count badge. */
  setUnreadCount(count: number): void {
    this.unreadCount = count;
    this.render(this.daemon.getStatus());
  }

  /** Update the pending changes count. */
  setPendingCount(count: number): void {
    this.pendingCount = count;
    this.render(this.daemon.getStatus());
  }

  private render(status: DaemonStatus): void {
    if (status === "running") {
      const parts: string[] = [];
      if (this.pendingCount > 0) {
        parts.push(`${this.pendingCount} pending`);
      }
      if (this.unreadCount > 0) {
        parts.push(`${this.unreadCount} unread`);
      }
      const suffix = parts.length > 0 ? ` (${parts.join(", ")})` : "";
      this.item.text = `$(pass-filled) JJHub: Online${suffix}`;
    } else if (status === "stopped") {
      this.item.text = "$(circle-slash) JJHub: Offline";
    } else if (status === "starting") {
      this.item.text = "$(loading~spin) JJHub: Starting...";
    } else {
      this.item.text = "$(warning) JJHub: Error";
    }

    // Color coding
    if (status === "error") {
      this.item.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.errorBackground",
      );
    } else if (status === "stopped") {
      this.item.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground",
      );
    } else {
      this.item.backgroundColor = undefined;
    }
  }

  private startPolling(): void {
    this.pollTimer = setInterval(async () => {
      // Check daemon health
      const alive = await this.daemon.isRunning();
      const currentStatus = this.daemon.getStatus();
      if (alive && currentStatus !== "running") {
        // Daemon came back online — status will be updated via daemon manager
      } else if (!alive && currentStatus === "running") {
        // Daemon went offline
      }

      // Fetch sync status for pending count
      if (alive) {
        const repo = detectRepo();
        if (repo) {
          try {
            const syncRes = await this.api.get<{
              pending_changes: number;
            }>(`/api/v1/repos/${repo.fullName}/sync/status`);
            if (syncRes.data) {
              this.setPendingCount(syncRes.data.pending_changes);
            }
          } catch {
            // Ignore sync status errors during polling
          }

          // Fetch notification count
          try {
            const notifRes = await this.api.get<{
              unread: number;
            }>("/api/v1/notifications/unread");
            if (notifRes.data) {
              this.setUnreadCount(notifRes.data.unread);
            }
          } catch {
            // Ignore notification errors during polling
          }
        }
      }
    }, 10_000);
  }

  dispose(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
    this.item.dispose();
  }
}
