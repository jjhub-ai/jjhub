import * as vscode from "vscode";
import { JJHubApiClient } from "./api";
import { DaemonManager } from "./daemon";
import { detectRepo, clearRepoCache } from "./repo";
import { JJScmProvider } from "./scm/provider";
import { StatusBarManager } from "./statusbar";
import { IssuesTreeProvider, showIssueDetail } from "./views/issues";
import { LandingsTreeProvider, showLandingDetail } from "./views/landings";
import { BookmarksTreeProvider } from "./views/bookmarks";
import { SyncTreeProvider } from "./views/sync";
import { DashboardPanel } from "./views/webview";

let daemon: DaemonManager;
let statusBar: StatusBarManager;
let scmProvider: JJScmProvider | undefined;

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
  statusBar = new StatusBarManager(daemon, api);
  context.subscriptions.push(statusBar);

  // ── SCM provider ────────────────────────────────────────────
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    scmProvider = new JJScmProvider(workspaceFolder.uri.fsPath, context);
    context.subscriptions.push({ dispose: () => scmProvider?.dispose() });
  }

  // ── Tree view providers ──────────────────────────────────────
  const issuesProvider = new IssuesTreeProvider(api);
  issuesProvider.setExtensionUri(context.extensionUri);

  const landingsProvider = new LandingsTreeProvider(api);
  const bookmarksProvider = new BookmarksTreeProvider(api);
  const syncProvider = new SyncTreeProvider(api);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("jjhub-issues", issuesProvider),
    vscode.window.registerTreeDataProvider(
      "jjhub-landings",
      landingsProvider,
    ),
    vscode.window.registerTreeDataProvider(
      "jjhub-bookmarks",
      bookmarksProvider,
    ),
    vscode.window.registerTreeDataProvider("jjhub-sync", syncProvider),
  );

  // ── Commands ─────────────────────────────────────────────────
  const config = vscode.workspace.getConfiguration("jjhub");
  const daemonUrl = config.get<string>(
    "daemonUrl",
    "http://localhost:4000",
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("jjhub.openDashboard", () => {
      DashboardPanel.show(context.extensionUri, daemonUrl);
    }),

    vscode.commands.registerCommand("jjhub.createIssue", async () => {
      const repo = detectRepo();
      if (!repo) {
        vscode.window.showWarningMessage(
          "No JJHub repository detected in current workspace.",
        );
        return;
      }

      const title = await vscode.window.showInputBox({
        prompt: "Issue title",
        placeHolder: "Describe the issue...",
      });
      if (!title) {
        return;
      }

      const body = await vscode.window.showInputBox({
        prompt: "Issue description (optional)",
        placeHolder: "Provide more details...",
      });

      const res = await api.post(
        `/api/v1/repos/${repo.fullName}/issues`,
        { title, body: body ?? "" },
      );
      if (res.error) {
        vscode.window.showErrorMessage(
          `Failed to create issue: ${res.error.message}`,
        );
      } else {
        vscode.window.showInformationMessage(`Issue created: ${title}`);
        issuesProvider.refresh();
      }
    }),

    vscode.commands.registerCommand(
      "jjhub.openIssueDetail",
      (issue, extensionUri) => {
        showIssueDetail(issue, extensionUri);
      },
    ),

    vscode.commands.registerCommand("jjhub.openLandingDetail", (lr) => {
      showLandingDetail(lr);
    }),

    vscode.commands.registerCommand(
      "jjhub.openChangeDiff",
      async (bookmark) => {
        const repo = detectRepo();
        if (!repo || !bookmark) {
          return;
        }
        const res = await api.get<{ diff: string }>(
          `/api/v1/repos/${repo.fullName}/changes/${bookmark.change_id}/diff`,
        );
        if (res.data) {
          const doc = await vscode.workspace.openTextDocument({
            content: res.data.diff,
            language: "diff",
          });
          await vscode.window.showTextDocument(doc, { preview: true });
        } else {
          vscode.window.showErrorMessage(
            "Failed to load change diff.",
          );
        }
      },
    ),

    vscode.commands.registerCommand("jjhub.openInBrowser", () => {
      const repo = detectRepo();
      if (!repo) {
        vscode.window.showWarningMessage(
          "No JJHub repository detected in current workspace.",
        );
        return;
      }
      vscode.env.openExternal(
        vscode.Uri.parse(`https://jjhub.tech/${repo.fullName}`),
      );
    }),

    vscode.commands.registerCommand("jjhub.search", async () => {
      const query = await vscode.window.showInputBox({
        prompt: "Search JJHub",
        placeHolder: "Search issues, landing requests, changes...",
      });
      if (!query) {
        return;
      }
      vscode.window.showInformationMessage(
        `Search for "${query}" — coming soon.`,
      );
    }),

    vscode.commands.registerCommand("jjhub.syncNow", async () => {
      const repo = detectRepo();
      if (!repo) {
        vscode.window.showWarningMessage(
          "No JJHub repository detected in current workspace.",
        );
        return;
      }

      const res = await api.post(
        `/api/v1/repos/${repo.fullName}/sync`,
      );
      if (res.error) {
        vscode.window.showErrorMessage(
          `Sync failed: ${res.error.message}`,
        );
      } else {
        vscode.window.showInformationMessage("Sync complete.");
        bookmarksProvider.refresh();
        landingsProvider.refresh();
        issuesProvider.refresh();
        syncProvider.refresh();
      }
    }),

    vscode.commands.registerCommand("jjhub.connectRepo", async () => {
      const repo = detectRepo();
      if (!repo) {
        vscode.window.showWarningMessage(
          "No JJHub repository detected in current workspace.",
        );
        return;
      }

      const res = await api.post(
        `/api/v1/repos/${repo.fullName}/sync/connect`,
      );
      if (res.error) {
        vscode.window.showErrorMessage(
          `Failed to connect: ${res.error.message}`,
        );
      } else {
        vscode.window.showInformationMessage(
          `Connected to ${repo.fullName}`,
        );
        syncProvider.refresh();
      }
    }),

    vscode.commands.registerCommand("jjhub.focusSync", () => {
      vscode.commands.executeCommand("jjhub-sync.focus");
    }),

    vscode.commands.registerCommand("jjhub.openWorkspace", async () => {
      const uri = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: "Open JJHub Workspace",
      });
      if (uri && uri.length > 0) {
        await vscode.commands.executeCommand(
          "vscode.openFolder",
          uri[0],
        );
      }
    }),
  );

  // ── React to config / workspace changes ────────────────────
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("jjhub")) {
        api.reload();
      }
    }),

    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      clearRepoCache();
      issuesProvider.refresh();
      landingsProvider.refresh();
      bookmarksProvider.refresh();
      syncProvider.refresh();
    }),
  );
}

export function deactivate(): void {
  daemon?.dispose();
}
