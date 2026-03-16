import * as vscode from "vscode";
import { JJHubApiClient } from "../api";

export interface Bookmark {
  name: string;
  change_id: string;
  commit_id: string;
  is_tracking: boolean;
  remote?: string;
}

export class BookmarkTreeItem extends vscode.TreeItem {
  constructor(public readonly bookmark: Bookmark) {
    super(bookmark.name, vscode.TreeItemCollapsibleState.None);

    const changeShort = bookmark.change_id.slice(0, 12);
    this.description = changeShort;
    this.tooltip = [
      `Bookmark: ${bookmark.name}`,
      `Change: ${bookmark.change_id}`,
      `Commit: ${bookmark.commit_id}`,
      bookmark.is_tracking
        ? `Tracking: ${bookmark.remote ?? "origin"}`
        : "Local only",
    ].join("\n");

    this.iconPath = new vscode.ThemeIcon(
      bookmark.is_tracking ? "git-branch" : "bookmark",
    );
    this.contextValue = bookmark.is_tracking
      ? "bookmark-tracking"
      : "bookmark-local";
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
    if (element) {
      return [];
    }

    await this.fetchBookmarks();

    if (this.bookmarks.length === 0) {
      return [
        new vscode.TreeItem(
          "No bookmarks",
          vscode.TreeItemCollapsibleState.None,
        ),
      ];
    }

    return this.bookmarks.map((b) => new BookmarkTreeItem(b));
  }

  private async fetchBookmarks(): Promise<void> {
    const res = await this.api.get<Bookmark[]>("/api/v1/repos/bookmarks");
    if (res.data) {
      this.bookmarks = res.data;
    }
  }
}
