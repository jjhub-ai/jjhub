import * as vscode from "vscode";
import { DaemonManager, DaemonStatus } from "./daemon";

const STATUS_ICONS: Record<DaemonStatus, string> = {
  running: "$(check)",
  stopped: "$(circle-slash)",
  starting: "$(loading~spin)",
  error: "$(warning)",
};

const STATUS_LABELS: Record<DaemonStatus, string> = {
  running: "JJHub: Synced",
  stopped: "JJHub: Offline",
  starting: "JJHub: Starting...",
  error: "JJHub: Error",
};

export class StatusBarManager {
  private readonly item: vscode.StatusBarItem;
  private unreadCount = 0;

  constructor(private readonly daemon: DaemonManager) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100,
    );
    this.item.command = "jjhub.openDashboard";
    this.item.tooltip = "Click to open JJHub dashboard";

    this.daemon.onStatusChange((status) => this.render(status));
    this.render(this.daemon.getStatus());
    this.item.show();
  }

  /** Update the unread notification count badge. */
  setUnreadCount(count: number): void {
    this.unreadCount = count;
    this.render(this.daemon.getStatus());
  }

  private render(status: DaemonStatus): void {
    const icon = STATUS_ICONS[status];
    let label = STATUS_LABELS[status];

    if (this.unreadCount > 0 && status === "running") {
      label = `JJHub: ${this.unreadCount} unread`;
    }

    this.item.text = `${icon} ${label}`;

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

  dispose(): void {
    this.item.dispose();
  }
}
