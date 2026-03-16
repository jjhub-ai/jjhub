import * as vscode from "vscode";
import { JJHubApiClient } from "../api";

export interface LandingRequest {
  id: number;
  number: number;
  title: string;
  status: "open" | "approved" | "queued" | "landed" | "rejected";
  author: { login: string };
  change_ids: string[];
  created_at: string;
  updated_at: string;
}

const STATUS_ICONS: Record<LandingRequest["status"], string> = {
  open: "git-pull-request",
  approved: "check",
  queued: "loading~spin",
  landed: "git-merge",
  rejected: "close",
};

export class LandingTreeItem extends vscode.TreeItem {
  constructor(public readonly lr: LandingRequest) {
    super(
      `#${lr.number} ${lr.title}`,
      vscode.TreeItemCollapsibleState.None,
    );
    this.tooltip = [
      lr.title,
      `Status: ${lr.status}`,
      `Author: ${lr.author.login}`,
      `Changes: ${lr.change_ids.join(", ")}`,
      `Updated: ${lr.updated_at}`,
    ].join("\n");
    this.description = lr.status;
    this.iconPath = new vscode.ThemeIcon(STATUS_ICONS[lr.status]);
    this.contextValue = `landing-${lr.status}`;
    this.command = {
      command: "jjhub.openDashboard",
      title: "Open Landing Request",
      arguments: [lr],
    };
  }
}

export class LandingsTreeProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private readonly onDidChangeEmitter = new vscode.EventEmitter<
    vscode.TreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this.onDidChangeEmitter.event;

  private landings: LandingRequest[] = [];

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
    if (element) {
      return [];
    }

    await this.fetchLandings();

    if (this.landings.length === 0) {
      return [
        new vscode.TreeItem(
          "No landing requests",
          vscode.TreeItemCollapsibleState.None,
        ),
      ];
    }

    return this.landings.map((lr) => new LandingTreeItem(lr));
  }

  private async fetchLandings(): Promise<void> {
    const res = await this.api.get<LandingRequest[]>(
      "/api/v1/repos/landings",
    );
    if (res.data) {
      this.landings = res.data;
    }
  }
}
