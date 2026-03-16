import * as vscode from "vscode";
import { JJHubApiClient } from "../api";
import { detectRepo } from "../repo";

export interface LandingRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  status: "open" | "approved" | "queued" | "landed" | "rejected";
  author: { login: string };
  change_ids: string[];
  diff_stats: { additions: number; deletions: number } | null;
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

const STATUS_COLORS: Record<LandingRequest["status"], string> = {
  open: "charts.blue",
  approved: "charts.green",
  queued: "charts.yellow",
  landed: "charts.purple",
  rejected: "charts.red",
};

type LRGroup = {
  label: string;
  status: LandingRequest["status"];
  items: LandingRequest[];
};

export class LandingTreeItem extends vscode.TreeItem {
  constructor(public readonly lr: LandingRequest) {
    super(
      `#${lr.number} ${lr.title}`,
      vscode.TreeItemCollapsibleState.None,
    );
    const stats = lr.diff_stats
      ? `+${lr.diff_stats.additions} -${lr.diff_stats.deletions}`
      : "";
    this.tooltip = new vscode.MarkdownString(
      [
        `**#${lr.number} ${lr.title}**`,
        "",
        `Status: ${lr.status} | Author: ${lr.author.login}`,
        `Changes: ${lr.change_ids.map((c) => c.slice(0, 12)).join(", ")}`,
        stats ? `Diff: ${stats}` : "",
        "",
        `Updated: ${new Date(lr.updated_at).toLocaleString()}`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    this.description = lr.status;
    this.iconPath = new vscode.ThemeIcon(
      STATUS_ICONS[lr.status],
      new vscode.ThemeColor(STATUS_COLORS[lr.status]),
    );
    this.contextValue = `landing-${lr.status}`;
    this.command = {
      command: "jjhub.openLandingDetail",
      title: "Open Landing Request",
      arguments: [lr],
    };
  }
}

class LRGroupItem extends vscode.TreeItem {
  constructor(public readonly group: LRGroup) {
    super(
      `${group.label} (${group.items.length})`,
      group.status === "open" || group.status === "approved" || group.status === "queued"
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed,
    );
    this.iconPath = new vscode.ThemeIcon(
      STATUS_ICONS[group.status],
      new vscode.ThemeColor(STATUS_COLORS[group.status]),
    );
    this.contextValue = "landing-group";
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
    if (!element) {
      const repo = detectRepo();
      if (!repo) {
        return [
          new vscode.TreeItem(
            "No JJHub repository detected",
            vscode.TreeItemCollapsibleState.None,
          ),
        ];
      }

      await this.fetchLandings(repo.fullName);

      if (this.landings.length === 0) {
        return [
          new vscode.TreeItem(
            "No landing requests",
            vscode.TreeItemCollapsibleState.None,
          ),
        ];
      }

      // Group by status
      const byStatus = new Map<LandingRequest["status"], LandingRequest[]>();
      for (const lr of this.landings) {
        const list = byStatus.get(lr.status) ?? [];
        list.push(lr);
        byStatus.set(lr.status, list);
      }

      const statusOrder: LandingRequest["status"][] = [
        "open",
        "approved",
        "queued",
        "landed",
        "rejected",
      ];
      const statusLabels: Record<LandingRequest["status"], string> = {
        open: "Open",
        approved: "Approved",
        queued: "Queued",
        landed: "Landed",
        rejected: "Rejected",
      };

      const groups: LRGroup[] = [];
      for (const status of statusOrder) {
        const items = byStatus.get(status);
        if (items && items.length > 0) {
          groups.push({
            label: statusLabels[status],
            status,
            items,
          });
        }
      }

      // If only one group, skip grouping and show items directly
      if (groups.length === 1) {
        return groups[0].items.map((lr) => new LandingTreeItem(lr));
      }

      return groups.map((g) => new LRGroupItem(g));
    }

    if (element instanceof LRGroupItem) {
      return element.group.items.map((lr) => new LandingTreeItem(lr));
    }

    return [];
  }

  private async fetchLandings(repoFullName: string): Promise<void> {
    const res = await this.api.get<LandingRequest[]>(
      `/api/v1/repos/${repoFullName}/landings`,
    );
    if (res.data) {
      this.landings = res.data;
    }
  }
}

/** Open an LR detail with diff in a webview panel. */
export function showLandingDetail(lr: LandingRequest): void {
  const panel = vscode.window.createWebviewPanel(
    "jjhub.landingDetail",
    `LR #${lr.number}: ${lr.title}`,
    vscode.ViewColumn.One,
    { enableScripts: true },
  );

  const stats = lr.diff_stats
    ? `<span style="color:#3fb950">+${lr.diff_stats.additions}</span> / <span style="color:#f85149">-${lr.diff_stats.deletions}</span>`
    : "";

  const changesHtml = lr.change_ids
    .map(
      (c) =>
        `<code style="background:var(--vscode-textCodeBlock-background);padding:2px 6px;border-radius:4px;">${escapeHtml(c.slice(0, 12))}</code>`,
    )
    .join(" ");

  panel.webview.html = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LR #${lr.number}</title>
  <style>
    body {
      font-family: var(--vscode-font-family, system-ui, sans-serif);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 20px;
      line-height: 1.6;
    }
    .header { margin-bottom: 16px; }
    .title { font-size: 1.4em; font-weight: 600; margin: 0; }
    .meta { color: var(--vscode-descriptionForeground); font-size: 0.9em; margin-top: 4px; }
    .status {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-right: 8px;
    }
    .status-open { background: #1f6feb; color: #fff; }
    .status-approved { background: #238636; color: #fff; }
    .status-queued { background: #d29922; color: #fff; }
    .status-landed { background: #8957e5; color: #fff; }
    .status-rejected { background: #da3633; color: #fff; }
    .changes { margin-top: 12px; }
    .changes-label { font-weight: 600; margin-bottom: 4px; }
    .body {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--vscode-panel-border);
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="title">#${lr.number} ${escapeHtml(lr.title)}</h1>
    <div class="meta">
      <span class="status status-${lr.status}">${lr.status}</span>
      by <strong>${escapeHtml(lr.author.login)}</strong>
      on ${new Date(lr.created_at).toLocaleDateString()}
      ${stats ? ` &middot; ${stats}` : ""}
    </div>
    <div class="changes">
      <div class="changes-label">Changes:</div>
      ${changesHtml}
    </div>
  </div>
  <div class="body">${escapeHtml(lr.body || "No description provided.")}</div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
