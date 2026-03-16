import * as vscode from "vscode";
import { JJHubApiClient } from "../api";

export interface Issue {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  labels: { name: string; color: string }[];
  assignee?: { login: string };
  created_at: string;
  updated_at: string;
}

type IssueGroup = { label: string; state: "open" | "closed"; issues: Issue[] };

export class IssueTreeItem extends vscode.TreeItem {
  constructor(
    public readonly issue: Issue,
  ) {
    super(
      `#${issue.number} ${issue.title}`,
      vscode.TreeItemCollapsibleState.None,
    );
    this.tooltip = `${issue.title}\nState: ${issue.state}\nUpdated: ${issue.updated_at}`;
    this.description = issue.assignee?.login ?? "";
    this.iconPath = new vscode.ThemeIcon(
      issue.state === "open" ? "issues" : "issue-closed",
    );
    this.contextValue = `issue-${issue.state}`;
    this.command = {
      command: "jjhub.openDashboard",
      title: "Open Issue",
      arguments: [issue],
    };
  }
}

class IssueGroupItem extends vscode.TreeItem {
  constructor(public readonly group: IssueGroup) {
    super(
      `${group.label} (${group.issues.length})`,
      vscode.TreeItemCollapsibleState.Expanded,
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
      // Root: fetch issues then show groups
      await this.fetchIssues();
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
      return element.group.issues.map((issue) => new IssueTreeItem(issue));
    }

    return [];
  }

  private async fetchIssues(): Promise<void> {
    const res = await this.api.get<Issue[]>("/api/v1/repos/issues");
    if (res.data) {
      this.issues = res.data;
    }
  }
}
