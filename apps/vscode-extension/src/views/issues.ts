import * as vscode from "vscode";
import { JJHubApiClient } from "../api";
import { detectRepo } from "../repo";

export interface Issue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  labels: { name: string; color: string }[];
  assignee?: { login: string };
  user: { login: string };
  comments: number;
  created_at: string;
  updated_at: string;
}

type IssueGroup = { label: string; state: "open" | "closed"; issues: Issue[] };

export class IssueTreeItem extends vscode.TreeItem {
  constructor(
    public readonly issue: Issue,
    private readonly extensionUri: vscode.Uri,
  ) {
    super(
      `#${issue.number} ${issue.title}`,
      vscode.TreeItemCollapsibleState.None,
    );
    this.tooltip = new vscode.MarkdownString(
      [
        `**#${issue.number} ${issue.title}**`,
        "",
        `State: ${issue.state} | Author: ${issue.user.login}`,
        issue.assignee ? `Assignee: ${issue.assignee.login}` : "",
        issue.labels.length > 0
          ? `Labels: ${issue.labels.map((l) => l.name).join(", ")}`
          : "",
        `Comments: ${issue.comments}`,
        "",
        `Updated: ${new Date(issue.updated_at).toLocaleString()}`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    this.description = issue.assignee?.login ?? "";
    this.iconPath = new vscode.ThemeIcon(
      issue.state === "open" ? "issues" : "issue-closed",
      issue.state === "open"
        ? new vscode.ThemeColor("charts.green")
        : new vscode.ThemeColor("charts.red"),
    );
    this.contextValue = `issue-${issue.state}`;
    this.command = {
      command: "jjhub.openIssueDetail",
      title: "Open Issue",
      arguments: [issue, this.extensionUri],
    };
  }
}

class IssueGroupItem extends vscode.TreeItem {
  constructor(public readonly group: IssueGroup) {
    super(
      `${group.label} (${group.issues.length})`,
      group.state === "open"
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed,
    );
    this.iconPath = new vscode.ThemeIcon(
      group.state === "open" ? "issues" : "issue-closed",
    );
    this.contextValue = "issue-group";
  }
}

export class IssuesTreeProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private readonly onDidChangeEmitter = new vscode.EventEmitter<
    vscode.TreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this.onDidChangeEmitter.event;

  private issues: Issue[] = [];
  private extensionUri: vscode.Uri | undefined;

  constructor(private readonly api: JJHubApiClient) {}

  setExtensionUri(uri: vscode.Uri): void {
    this.extensionUri = uri;
  }

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

      await this.fetchIssues(repo.fullName);
      const open = this.issues.filter((i) => i.state === "open");
      const closed = this.issues.filter((i) => i.state === "closed");
      const groups: IssueGroup[] = [];
      if (open.length > 0) {
        groups.push({ label: "Open", state: "open", issues: open });
      }
      if (closed.length > 0) {
        groups.push({ label: "Closed", state: "closed", issues: closed });
      }
      if (groups.length === 0) {
        return [
          new vscode.TreeItem(
            "No issues found",
            vscode.TreeItemCollapsibleState.None,
          ),
        ];
      }
      return groups.map((g) => new IssueGroupItem(g));
    }

    if (element instanceof IssueGroupItem) {
      return element.group.issues.map(
        (issue) =>
          new IssueTreeItem(
            issue,
            this.extensionUri ?? vscode.Uri.file(""),
          ),
      );
    }

    return [];
  }

  private async fetchIssues(repoFullName: string): Promise<void> {
    const res = await this.api.get<Issue[]>(
      `/api/v1/repos/${repoFullName}/issues`,
    );
    if (res.data) {
      this.issues = res.data;
    }
  }
}

/** Open an issue detail in a webview panel. */
export function showIssueDetail(
  issue: Issue,
  extensionUri: vscode.Uri,
): void {
  const panel = vscode.window.createWebviewPanel(
    "jjhub.issueDetail",
    `Issue #${issue.number}: ${issue.title}`,
    vscode.ViewColumn.One,
    { enableScripts: true },
  );

  const labelsHtml = issue.labels
    .map(
      (l) =>
        `<span style="background:#${l.color};color:#fff;padding:2px 8px;border-radius:12px;font-size:12px;margin-right:4px;">${escapeHtml(l.name)}</span>`,
    )
    .join("");

  panel.webview.html = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Issue #${issue.number}</title>
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
    .state {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-right: 8px;
    }
    .state-open { background: #238636; color: #fff; }
    .state-closed { background: #da3633; color: #fff; }
    .labels { margin-top: 8px; }
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
    <h1 class="title">#${issue.number} ${escapeHtml(issue.title)}</h1>
    <div class="meta">
      <span class="state state-${issue.state}">${issue.state}</span>
      Opened by <strong>${escapeHtml(issue.user.login)}</strong>
      on ${new Date(issue.created_at).toLocaleDateString()}
      ${issue.assignee ? ` &middot; Assigned to <strong>${escapeHtml(issue.assignee.login)}</strong>` : ""}
      &middot; ${issue.comments} comment${issue.comments !== 1 ? "s" : ""}
    </div>
    ${labelsHtml ? `<div class="labels">${labelsHtml}</div>` : ""}
  </div>
  <div class="body">${escapeHtml(issue.body || "No description provided.")}</div>
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
