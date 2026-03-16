import * as vscode from "vscode";
import { execFile } from "child_process";

/** The status of a file in a jj change. */
export type FileStatus = "added" | "modified" | "deleted" | "renamed" | "copied";

/** A single file entry from `jj diff --summary`. */
export interface JJFileChange {
  status: FileStatus;
  path: string;
  /** For renames/copies, the original path. */
  origPath?: string;
}

/** Parsed output of `jj status`. */
export interface JJStatus {
  /** Current change ID (short form). */
  changeId: string;
  /** Current change description. */
  description: string;
  /** Working copy file changes. */
  files: JJFileChange[];
}

/**
 * Wrapper around jj CLI commands.
 * All commands are executed in the workspace root folder.
 */
export class JJCli {
  constructor(private readonly workspaceRoot: string) {}

  /** Execute a jj command and return stdout. */
  private exec(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        "jj",
        args,
        {
          cwd: this.workspaceRoot,
          maxBuffer: 10 * 1024 * 1024,
          env: { ...process.env, JJ_COLOR: "never" },
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
            return;
          }
          resolve(stdout);
        },
      );
    });
  }

  /**
   * Parse `jj diff --summary` output.
   * Output format: "M path/to/file" or "A path/to/file" etc.
   */
  async diffSummary(changeId?: string): Promise<JJFileChange[]> {
    const args = ["diff", "--summary"];
    if (changeId) {
      args.push("-r", changeId);
    }
    const stdout = await this.exec(args);
    return this.parseDiffSummary(stdout);
  }

  private parseDiffSummary(output: string): JJFileChange[] {
    const files: JJFileChange[] = [];
    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      // Format: "M path/to/file" or "R {old => new}"
      const statusChar = trimmed[0];
      const rest = trimmed.slice(2).trim();

      let status: FileStatus;
      switch (statusChar) {
        case "A":
          status = "added";
          break;
        case "M":
          status = "modified";
          break;
        case "D":
          status = "deleted";
          break;
        case "R":
          status = "renamed";
          break;
        case "C":
          status = "copied";
          break;
        default:
          status = "modified";
          break;
      }

      if (status === "renamed" || status === "copied") {
        // jj outputs: "R {old => new}" — parse both paths
        const match = rest.match(/\{(.+?)\s+=>\s+(.+?)\}/);
        if (match) {
          files.push({ status, path: match[2], origPath: match[1] });
        } else {
          files.push({ status, path: rest });
        }
      } else {
        files.push({ status, path: rest });
      }
    }
    return files;
  }

  /**
   * Parse `jj status` to get the current change info.
   * Extracts the change ID and description from log, and file changes from diff.
   */
  async status(): Promise<JJStatus> {
    // Get current change ID
    const changeIdOut = await this.exec([
      "log",
      "-r",
      "@",
      "--no-graph",
      "-T",
      "change_id.shortest(8)",
    ]);
    const changeId = changeIdOut.trim();

    // Get current description
    const descOut = await this.exec([
      "log",
      "-r",
      "@",
      "--no-graph",
      "-T",
      "description",
    ]);
    const description = descOut.trim();

    // Get file changes in working copy
    const files = await this.diffSummary();

    return { changeId, description, files };
  }

  /**
   * Get file contents at a specific change.
   * Uses `jj file show` to retrieve the file content.
   */
  async fileShow(changeId: string, path: string): Promise<string> {
    return this.exec(["file", "show", "-r", changeId, path]);
  }

  /** Set the description of the current change. */
  async describe(message: string): Promise<void> {
    await this.exec(["describe", "-m", message]);
  }

  /** Create a new change on top of the current one. */
  async new(): Promise<void> {
    await this.exec(["new"]);
  }

  /** Squash the current change into its parent. */
  async squash(): Promise<void> {
    await this.exec(["squash"]);
  }

  /** Abandon the current change. */
  async abandon(): Promise<void> {
    await this.exec(["abandon"]);
  }

  /**
   * Restore a file to its state in the parent change.
   * Uses `jj restore --from @- <path>`.
   */
  async restoreFile(path: string): Promise<void> {
    await this.exec(["restore", "--from", "@-", path]);
  }

  /**
   * Get the parent change ID (the change before @).
   * Used for quick diff base.
   */
  async parentChangeId(): Promise<string> {
    const out = await this.exec([
      "log",
      "-r",
      "@-",
      "--no-graph",
      "-T",
      "change_id.shortest(8)",
    ]);
    return out.trim();
  }
}
