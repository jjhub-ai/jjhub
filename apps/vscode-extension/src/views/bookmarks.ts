import * as vscode from "vscode";
import { JJHubApiClient } from "../api";
import { detectRepo } from "../repo";

export interface Bookmark {
  name: string;
  change_id: string;
  commit_id: string;
  description: string;
  is_tracking: boolean;
  remote?: string;
}

type BookmarkGroup = {
  label: string;
  type: "tracking" | "local";
  bookmarks: Bookmark[];
};

export class BookmarkTreeItem extends vscode.TreeItem {
  constructor(public readonly bookmark: Bookmark) {
    super(bookmark.name, vscode.TreeItemCollapsibleState.None);

    const changeShort = bookmark.change_id.slice(0, 12);
    this.description = changeShort;
    this.tooltip = new vscode.MarkdownString(
      [
        `**${bookmark.name}**`,
        "",
        `Change: \`${bookmark.change_id}\``,
        `Commit: \`${bookmark.commit_id}\``,
        bookmark.description
          ? `Description: ${bookmark.description}`
          : "",
        "",
        bookmark.is_tracking
          ? `Tracking: ${bookmark.remote ?? "origin"}`
          : "Local only",
      ]
        .filter(Boolean)
        .join("\n"),
    );

    this.iconPath = new vscode.ThemeIcon(
      bookmark.is_tracking ? "git-branch" : "bookmark",
      bookmark.is_tracking
        ? new vscode.ThemeColor("charts.blue")
        : new vscode.ThemeColor("charts.yellow"),
    );
    this.contextValue = bookmark.is_tracking
      ? "bookmark-tracking"
      : "bookmark-local";
    this.command = {
      command: "jjhub.openChangeDiff",
      title: "Open Change Diff",
      arguments: [bookmark],
    };
  }
}

class BookmarkGroupItem extends vscode.TreeItem {
  constructor(public readonly group: BookmarkGroup) {
    super(
      `${group.label} (${group.bookmarks.length})`,
      vscode.TreeItemCollapsibleState.Expanded,
    );
    this.iconPath = new vscode.ThemeIcon(
      group.type === "tracking" ? "git-branch" : "bookmark",
    );
    this.contextValue = "bookmark-group";
  }
}

export class BookmarksTreeProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private readonly onDidChangeEmitter = new vscode.EventEmitter<
    vscode.TreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this.onDidChangeEmitter.event;

  private bookmarks: Bookmark[] = [];

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

      await this.fetchBookmarks(repo.fullName);

      if (this.bookmarks.length === 0) {
        return [
          new vscode.TreeItem(
            "No bookmarks",
            vscode.TreeItemCollapsibleState.None,
          ),
        ];
      }

      const tracking = this.bookmarks.filter((b) => b.is_tracking);
      const local = this.bookmarks.filter((b) => !b.is_tracking);

      // If all bookmarks are one type, skip grouping
      if (tracking.length === 0 || local.length === 0) {
        return this.bookmarks.map((b) => new BookmarkTreeItem(b));
      }

      const groups: BookmarkGroup[] = [];
      if (tracking.length > 0) {
        groups.push({
          label: "Tracking",
          type: "tracking",
          bookmarks: tracking,
        });
      }
      if (local.length > 0) {
        groups.push({ label: "Local", type: "local", bookmarks: local });
      }
      return groups.map((g) => new BookmarkGroupItem(g));
    }

    if (element instanceof BookmarkGroupItem) {
      return element.group.bookmarks.map((b) => new BookmarkTreeItem(b));
    }

    return [];
  }

  private async fetchBookmarks(repoFullName: string): Promise<void> {
    const res = await this.api.get<Bookmark[]>(
      `/api/v1/repos/${repoFullName}/bookmarks`,
    );
    if (res.data) {
      this.bookmarks = res.data;
    }
  }
}
