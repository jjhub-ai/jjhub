import * as vscode from "vscode";
import { JJCli, type FileStatus, type JJFileChange } from "./jj";

/** Map jj file status to a VS Code ThemeIcon for decorations. */
function statusToThemeIcon(status: FileStatus): vscode.ThemeIcon {
  switch (status) {
    case "added":
      return new vscode.ThemeIcon("diff-added");
    case "modified":
      return new vscode.ThemeIcon("diff-modified");
    case "deleted":
      return new vscode.ThemeIcon("diff-removed");
    case "renamed":
      return new vscode.ThemeIcon("diff-renamed");
    case "copied":
      return new vscode.ThemeIcon("diff-added");
    default:
      return new vscode.ThemeIcon("file");
  }
}

/** Short label for the status shown in the description column. */
function statusToLabel(status: FileStatus): string {
  switch (status) {
    case "added":
      return "A";
    case "modified":
      return "M";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    case "copied":
      return "C";
    default:
      return "?";
  }
}

/**
 * TextDocumentContentProvider for the `jj:` URI scheme.
 * Provides file contents at a specific jj change for inline diff.
 *
 * URI format: jj:/change-id/path/to/file
 */
export class JJDocumentContentProvider
  implements vscode.TextDocumentContentProvider
{
  private readonly onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this.onDidChangeEmitter.event;

  constructor(private readonly jj: JJCli) {}

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    // URI path: /change-id/path/to/file
    const fullPath = uri.path;
    const firstSlash = fullPath.indexOf("/", 1);
    if (firstSlash === -1) {
      return "";
    }
    const changeId = fullPath.substring(1, firstSlash);
    const filePath = fullPath.substring(firstSlash + 1);

    try {
      return await this.jj.fileShow(changeId, filePath);
    } catch {
      // File may not exist in this change (new file)
      return "";
    }
  }

  /** Fire change event to refresh cached content. */
  fireDidChange(uri: vscode.Uri): void {
    this.onDidChangeEmitter.fire(uri);
  }

  dispose(): void {
    this.onDidChangeEmitter.dispose();
  }
}

/**
 * JJ Source Control Manager provider.
 *
 * Registers as an SCM provider in VS Code's Source Control sidebar,
 * showing jj changes with file-level actions, quick diff, and
 * the describe input box.
 */
export class JJScmProvider {
  private readonly scm: vscode.SourceControl;
  private readonly workingCopyGroup: vscode.SourceControlResourceGroup;
  private readonly docProvider: JJDocumentContentProvider;
  private readonly jj: JJCli;
  private readonly disposables: vscode.Disposable[] = [];
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private parentChangeId = "@-";

  constructor(
    private readonly workspaceRoot: string,
    context: vscode.ExtensionContext,
  ) {
    this.jj = new JJCli(workspaceRoot);

    // Create the SCM provider
    this.scm = vscode.scm.createSourceControl("jj", "JJ", vscode.Uri.file(workspaceRoot));
    this.scm.acceptInputCommand = {
      command: "jjhub.scm.describe",
      title: "Describe",
    };
    this.scm.inputBox.placeholder = "Change description (Ctrl+Enter to describe)";

    // Resource group for working copy changes
    this.workingCopyGroup = this.scm.createResourceGroup(
      "workingCopy",
      "Working Copy",
    );
    this.workingCopyGroup.hideWhenEmpty = false;

    // Register the jj: URI scheme document provider for quick diff
    this.docProvider = new JJDocumentContentProvider(this.jj);
    this.disposables.push(
      vscode.workspace.registerTextDocumentContentProvider(
        "jj",
        this.docProvider,
      ),
    );

    // Set the quick diff base URI (parent change)
    this.scm.quickDiffProvider = {
      provideOriginalResource: (uri: vscode.Uri): vscode.Uri | undefined => {
        // Only provide for files within this workspace
        if (!uri.fsPath.startsWith(workspaceRoot)) {
          return undefined;
        }
        const relativePath = uri.fsPath.substring(workspaceRoot.length + 1);
        return vscode.Uri.parse(
          `jj:/${this.parentChangeId}/${relativePath}`,
        );
      },
    };

    // Register commands
    this.registerCommands(context);

    // Watch .jj/repo for changes to auto-refresh
    this.setupFileWatcher();

    // Add SCM to disposables
    this.disposables.push(this.scm);

    // Initial refresh
    this.refresh();
  }

  private registerCommands(context: vscode.ExtensionContext): void {
    this.disposables.push(
      // Describe — triggered by Ctrl+Enter in the SCM input box
      vscode.commands.registerCommand("jjhub.scm.describe", async () => {
        const message = this.scm.inputBox.value.trim();
        if (!message) {
          vscode.window.showWarningMessage("Enter a change description first.");
          return;
        }
        try {
          await this.jj.describe(message);
          this.scm.inputBox.value = "";
          vscode.window.showInformationMessage("Change described.");
          this.refresh();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`jj describe failed: ${msg}`);
        }
      }),

      // New change
      vscode.commands.registerCommand("jjhub.scm.new", async () => {
        try {
          await this.jj.new();
          vscode.window.showInformationMessage("New change created.");
          this.refresh();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`jj new failed: ${msg}`);
        }
      }),

      // Squash
      vscode.commands.registerCommand("jjhub.scm.squash", async () => {
        try {
          await this.jj.squash();
          vscode.window.showInformationMessage("Change squashed into parent.");
          this.refresh();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`jj squash failed: ${msg}`);
        }
      }),

      // Abandon
      vscode.commands.registerCommand("jjhub.scm.abandon", async () => {
        const answer = await vscode.window.showWarningMessage(
          "Abandon the current change? This cannot be undone.",
          { modal: true },
          "Abandon",
        );
        if (answer !== "Abandon") {
          return;
        }
        try {
          await this.jj.abandon();
          vscode.window.showInformationMessage("Change abandoned.");
          this.refresh();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`jj abandon failed: ${msg}`);
        }
      }),

      // Revert file — context menu on a resource state
      vscode.commands.registerCommand(
        "jjhub.scm.revertFile",
        async (resourceState: vscode.SourceControlResourceState) => {
          const relativePath = vscode.workspace.asRelativePath(
            resourceState.resourceUri,
          );
          const answer = await vscode.window.showWarningMessage(
            `Revert "${relativePath}" to its state in the parent change?`,
            { modal: true },
            "Revert",
          );
          if (answer !== "Revert") {
            return;
          }
          try {
            await this.jj.restoreFile(relativePath);
            vscode.window.showInformationMessage(`Reverted ${relativePath}`);
            this.refresh();
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`jj restore failed: ${msg}`);
          }
        },
      ),

      // Open file — clicking a resource state opens the diff view
      vscode.commands.registerCommand(
        "jjhub.scm.openFile",
        async (resourceState: vscode.SourceControlResourceState) => {
          const uri = resourceState.resourceUri;
          const relativePath = vscode.workspace.asRelativePath(uri);
          const parentUri = vscode.Uri.parse(
            `jj:/${this.parentChangeId}/${relativePath}`,
          );
          const title = `${relativePath} (jj diff)`;
          await vscode.commands.executeCommand(
            "vscode.diff",
            parentUri,
            uri,
            title,
          );
        },
      ),

      // Refresh
      vscode.commands.registerCommand("jjhub.scm.refresh", () => {
        this.refresh();
      }),
    );
  }

  private setupFileWatcher(): void {
    // Watch .jj/repo directory for operation log changes
    const jjRepoPattern = new vscode.RelativePattern(
      this.workspaceRoot,
      ".jj/repo/**",
    );
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(jjRepoPattern);

    const debouncedRefresh = () => {
      // Debounce: jj operations can trigger many file changes at once
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
      }
      this.refreshTimer = setTimeout(() => this.refresh(), 500);
    };

    this.fileWatcher.onDidChange(debouncedRefresh);
    this.fileWatcher.onDidCreate(debouncedRefresh);
    this.fileWatcher.onDidDelete(debouncedRefresh);

    this.disposables.push(this.fileWatcher);
  }

  /** Refresh the SCM state by re-running jj commands. */
  async refresh(): Promise<void> {
    try {
      const status = await this.jj.status();

      // Update parent change ID for quick diff
      try {
        this.parentChangeId = await this.jj.parentChangeId();
      } catch {
        this.parentChangeId = "@-";
      }

      // Update the SCM count badge
      this.scm.count = status.files.length;

      // Pre-fill input box with existing description if box is empty
      if (!this.scm.inputBox.value && status.description) {
        this.scm.inputBox.value = status.description;
      }

      // Update resource states
      this.workingCopyGroup.resourceStates = status.files.map((file) =>
        this.fileChangeToResourceState(file),
      );

      // Invalidate cached document content for quick diff
      for (const file of status.files) {
        const uri = vscode.Uri.parse(
          `jj:/${this.parentChangeId}/${file.path}`,
        );
        this.docProvider.fireDidChange(uri);
      }
    } catch (err: unknown) {
      // Silently fail if jj is not available or this isn't a jj repo
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("There is no jj repo") && !msg.includes("ENOENT")) {
        console.error("[jjhub-scm] refresh failed:", msg);
      }
    }
  }

  private fileChangeToResourceState(
    file: JJFileChange,
  ): vscode.SourceControlResourceState {
    const uri = vscode.Uri.file(`${this.workspaceRoot}/${file.path}`);

    const state: vscode.SourceControlResourceState = {
      resourceUri: uri,
      decorations: {
        strikeThrough: file.status === "deleted",
        tooltip: `${statusToLabel(file.status)} ${file.path}`,
        iconPath: statusToThemeIcon(file.status),
      },
      command: {
        command:
          file.status === "deleted"
            ? "jjhub.scm.revertFile"
            : "jjhub.scm.openFile",
        title: file.status === "deleted" ? "Revert File" : "Open Diff",
        arguments: [{ resourceUri: uri } as vscode.SourceControlResourceState],
      },
    };

    return state;
  }

  dispose(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.docProvider.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
