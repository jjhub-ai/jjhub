import * as vscode from "vscode";
import { JJHubApiClient } from "../api";
import { detectRepo } from "../repo";

export interface SyncStatus {
  connected: boolean;
  last_sync: string | null;
  pending_changes: number;
  conflicts: SyncConflict[];
}

export interface SyncConflict {
  path: string;
  change_id: string;
  description: string;
}

type SyncChildType = "status" | "pending" | "conflict-header" | "conflict";

class SyncStatusItem extends vscode.TreeItem {
  public childType: SyncChildType;

  constructor(
    label: string,
    childType: SyncChildType,
    options?: {
      description?: string;
      icon?: string;
      collapsible?: vscode.TreeItemCollapsibleState;
      command?: vscode.Command;
      contextValue?: string;
    },
  ) {
    super(
      label,
      options?.collapsible ?? vscode.TreeItemCollapsibleState.None,
    );
    this.childType = childType;
    if (options?.description) {
      this.description = options.description;
    }
    if (options?.icon) {
      this.iconPath = new vscode.ThemeIcon(options.icon);
    }
    if (options?.command) {
      this.command = options.command;
    }
    if (options?.contextValue) {
      this.contextValue = options.contextValue;
    }
  }
}

class SyncConflictItem extends vscode.TreeItem {
  public childType: SyncChildType = "conflict";

  constructor(public readonly conflict: SyncConflict) {
    super(conflict.path, vscode.TreeItemCollapsibleState.None);
    this.description = conflict.change_id.slice(0, 12);
    this.tooltip = [
      `Path: ${conflict.path}`,
      `Change: ${conflict.change_id}`,
      `Description: ${conflict.description}`,
    ].join("\n");
    this.iconPath = new vscode.ThemeIcon("warning");
    this.contextValue = "sync-conflict";
  }
}

export class SyncTreeProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private readonly onDidChangeEmitter = new vscode.EventEmitter<
    vscode.TreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this.onDidChangeEmitter.event;

  private syncStatus: SyncStatus | undefined;

  constructor(private readonly api: JJHubApiClient) {}

  refresh(): void {
    this.onDidChangeEmitter.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(
    element?: vscode.TreeItem,
  ): Promise<vscode.TreeItem[]> {
    const repo = detectRepo();

    if (!element) {
      await this.fetchSyncStatus(repo?.fullName);

      if (!this.syncStatus) {
        return [
          new SyncStatusItem("Not connected", "status", {
            icon: "debug-disconnect",
            description: "Click to connect",
            contextValue: "sync-disconnected",
            command: {
              command: "jjhub.connectRepo",
              title: "Connect Repository",
            },
          }),
        ];
      }

      const items: vscode.TreeItem[] = [];

      // Connection status
      const statusIcon = this.syncStatus.connected
        ? "pass-filled"
        : "circle-slash";
      const statusLabel = this.syncStatus.connected
        ? "Connected"
        : "Disconnected";
      items.push(
        new SyncStatusItem(statusLabel, "status", {
          icon: statusIcon,
          description: repo?.fullName ?? "",
          contextValue: this.syncStatus.connected
            ? "sync-connected"
            : "sync-disconnected",
        }),
      );

      // Last sync time
      if (this.syncStatus.last_sync) {
        const ago = formatTimeAgo(this.syncStatus.last_sync);
        items.push(
          new SyncStatusItem("Last sync", "status", {
            icon: "history",
            description: ago,
          }),
        );
      }

      // Pending changes
      if (this.syncStatus.pending_changes > 0) {
        items.push(
          new SyncStatusItem(
            `Pending changes: ${this.syncStatus.pending_changes}`,
            "pending",
            {
              icon: "cloud-upload",
              contextValue: "sync-pending",
            },
          ),
        );
      }

      // Conflicts
      if (this.syncStatus.conflicts.length > 0) {
        items.push(
          new SyncStatusItem(
            `Conflicts (${this.syncStatus.conflicts.length})`,
            "conflict-header",
            {
              icon: "warning",
              collapsible: vscode.TreeItemCollapsibleState.Expanded,
              contextValue: "sync-conflicts",
            },
          ),
        );
      }

      return items;
    }

    // Expand conflicts
    if (
      element instanceof SyncStatusItem &&
      element.childType === "conflict-header" &&
      this.syncStatus?.conflicts
    ) {
      return this.syncStatus.conflicts.map(
        (c) => new SyncConflictItem(c),
      );
    }

    return [];
  }

  private async fetchSyncStatus(repoFullName?: string): Promise<void> {
    const path = repoFullName
      ? `/api/v1/repos/${repoFullName}/sync/status`
      : "/api/v1/repos/sync/status";
    const res = await this.api.get<SyncStatus>(path);
    if (res.data) {
      this.syncStatus = res.data;
    } else {
      this.syncStatus = undefined;
    }
  }

  /** Expose current sync status for status bar consumption. */
  getSyncStatus(): SyncStatus | undefined {
    return this.syncStatus;
  }
}

function formatTimeAgo(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) {
    return `${diffSec}s ago`;
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return `${diffHr}h ago`;
  }
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}
