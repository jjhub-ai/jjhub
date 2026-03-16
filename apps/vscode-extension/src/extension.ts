import * as vscode from "vscode";
import { JJHubApiClient } from "./api";
import { DaemonManager } from "./daemon";
import { StatusBarManager } from "./statusbar";
import { IssuesTreeProvider } from "./views/issues";
import { LandingsTreeProvider } from "./views/landings";
import { BookmarksTreeProvider } from "./views/bookmarks";
import { DashboardPanel } from "./views/webview";

let daemon: DaemonManager;
let statusBar: StatusBarManager;

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const api = new JJHubApiClient();

  // ── Daemon management ────────────────────────────────────────
  daemon = new DaemonManager(api);
  context.subscriptions.push(daemon);

  await daemon.autoStart();
  daemon.startPolling();

  // ── Status bar ───────────────────────────────────────────────
  statusBar = new StatusBarManager(daemon);
  context.subscriptions.push(statusBar);

  // ── Tree view providers ──────────────────────────────────────
  const issuesProvider = new IssuesTreeProvider(api);
  const landingsProvider = new LandingsTreeProvider(api);
  const bookmarksProvider = new BookmarksTreeProvider(api);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("jjhub-issues", issuesProvider),
    vscode.window.registerTreeDataProvider("jjhub-landings", landingsProvider),
    vscode.window.registerTreeDataProvider("jjhub-bookmarks", bookmarksProvider),
  );

  // ── Commands ─────────────────────────────────────────────────
  const config = vscode.workspace.getConfiguration("jjhub");
  const daemonUrl = config.get<string>("daemonUrl", "http://localhost:4000");

  context.subscriptions.push(
    vscode.commands.registerCommand("jjhub.openDashboard", () => {
      DashboardPanel.show(context.extensionUri, daemonUrl);
    }),

    vscode.commands.registerCommand("jjhub.createIssue", async () => {
      const title = await vscode.window.showInputBox({
        prompt: "Issue title",
        placeHolder: "Describe the issue...",
      });
      if (!title) {
        return;
      }
      const res = await api.post("/api/v1/repos/issues", { title });
      if (res.error) {
        vscode.window.showErrorMessage(
          `Failed to create issue: ${res.error.message}`,
        );
      } else {
        vscode.window.showInformationMessage(`Issue created: ${title}`);
        issuesProvider.refresh();
      }
    }),

    vscode.commands.registerCommand("jjhub.search", async () => {
      const query = await vscode.window.showInputBox({
        prompt: "Search JJHub",
        placeHolder: "Search issues, landing requests, changes...",
      });
      if (!query) {
        return;
      }
      // Open dashboard with search query in the future; for now show info.
      vscode.window.showInformationMessage(
        `Search for "${query}" — coming soon.`,
      );
    }),

    vscode.commands.registerCommand("jjhub.syncNow", async () => {
      const res = await api.post("/api/v1/repos/sync");
      if (res.error) {
        vscode.window.showErrorMessage(
          `Sync failed: ${res.error.message}`,
        );
      } else {
        vscode.window.showInformationMessage("Sync complete.");
        bookmarksProvider.refresh();
        landingsProvider.refresh();
        issuesProvider.refresh();
      }
    }),

    vscode.commands.registerCommand("jjhub.openWorkspace", async () => {
      const uri = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: "Open JJHub Workspace",
      });
      if (uri && uri.length > 0) {
        await vscode.commands.executeCommand("vscode.openFolder", uri[0]);
      }
    }),
  );

  // ── React to config changes ──────────────────────────────────
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("jjhub")) {
        api.reload();
      }
    }),
  );
}

export function deactivate(): void {
  daemon?.dispose();
}
