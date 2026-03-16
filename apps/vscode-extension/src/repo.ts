import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export interface RepoInfo {
  owner: string;
  repo: string;
  /** Full "owner/repo" string. */
  fullName: string;
}

/** Per-workspace-folder cache of detected repo info. */
const cache = new Map<string, RepoInfo | null>();

/**
 * Detect owner/repo for the first workspace folder (or a specific one).
 * Looks for `.jj/repo/store/git` config first, then falls back to `.git/config`.
 * Results are cached per workspace folder path.
 */
export function detectRepo(
  folder?: vscode.WorkspaceFolder,
): RepoInfo | undefined {
  const ws =
    folder ?? vscode.workspace.workspaceFolders?.[0];
  if (!ws) {
    return undefined;
  }

  const root = ws.uri.fsPath;

  if (cache.has(root)) {
    return cache.get(root) ?? undefined;
  }

  const info = tryJJ(root) ?? tryGit(root);
  cache.set(root, info ?? null);
  return info ?? undefined;
}

/** Clear the cache (useful when workspace folders change). */
export function clearRepoCache(): void {
  cache.clear();
}

// ── Internal helpers ──────────────────────────────────────────────

/** Parse a jjhub.tech remote from jj colocated git config. */
function tryJJ(root: string): RepoInfo | undefined {
  // jj colocated repos store their git repo at .jj/repo/store/git
  // which is often a path reference. Try the colocated .git/config first.
  const colocatedGitConfig = path.join(root, ".git", "config");
  const jjGitDir = path.join(root, ".jj", "repo", "store", "git");

  // Prefer colocated .git/config (most common jj setup)
  if (fs.existsSync(colocatedGitConfig)) {
    return parseGitConfig(colocatedGitConfig);
  }

  // If .jj exists but no colocated git, check if there's a git dir pointer
  if (fs.existsSync(jjGitDir)) {
    try {
      const stat = fs.statSync(jjGitDir);
      if (stat.isDirectory()) {
        const configPath = path.join(jjGitDir, "config");
        if (fs.existsSync(configPath)) {
          return parseGitConfig(configPath);
        }
      } else {
        // It might be a file containing a path to the git dir
        const content = fs.readFileSync(jjGitDir, "utf-8").trim();
        const resolvedConfig = path.resolve(root, content, "config");
        if (fs.existsSync(resolvedConfig)) {
          return parseGitConfig(resolvedConfig);
        }
      }
    } catch {
      // Ignore fs errors
    }
  }

  return undefined;
}

/** Parse remote URL from .git/config. */
function tryGit(root: string): RepoInfo | undefined {
  const configPath = path.join(root, ".git", "config");
  if (!fs.existsSync(configPath)) {
    // .git might be a file (worktree / submodule)
    const gitFile = path.join(root, ".git");
    if (fs.existsSync(gitFile)) {
      try {
        const stat = fs.statSync(gitFile);
        if (!stat.isDirectory()) {
          const content = fs.readFileSync(gitFile, "utf-8").trim();
          const match = content.match(/^gitdir:\s*(.+)$/m);
          if (match) {
            const resolvedConfig = path.resolve(root, match[1], "config");
            if (fs.existsSync(resolvedConfig)) {
              return parseGitConfig(resolvedConfig);
            }
          }
        }
      } catch {
        // Ignore
      }
    }
    return undefined;
  }
  return parseGitConfig(configPath);
}

/**
 * Parse a git config file and extract the first remote URL that points
 * to jjhub.tech, returning the owner/repo.
 */
function parseGitConfig(configPath: string): RepoInfo | undefined {
  try {
    const content = fs.readFileSync(configPath, "utf-8");
    return parseRemoteUrl(content);
  } catch {
    return undefined;
  }
}

/** Extract owner/repo from remote URL lines in git config content. */
function parseRemoteUrl(content: string): RepoInfo | undefined {
  // Match SSH: git@jjhub.tech:owner/repo.git
  // Match SSH: ssh://git@ssh.jjhub.tech/owner/repo.git
  // Match HTTPS: https://jjhub.tech/owner/repo.git
  const urlLines = content.match(/url\s*=\s*(.+)/g);
  if (!urlLines) {
    return undefined;
  }

  for (const line of urlLines) {
    const url = line.replace(/url\s*=\s*/, "").trim();

    // SSH style: git@jjhub.tech:owner/repo.git
    const sshMatch = url.match(
      /git@(?:ssh\.)?jjhub\.tech[:/]([^/]+)\/([^/]+?)(?:\.git)?$/,
    );
    if (sshMatch) {
      return {
        owner: sshMatch[1],
        repo: sshMatch[2],
        fullName: `${sshMatch[1]}/${sshMatch[2]}`,
      };
    }

    // HTTPS style: https://jjhub.tech/owner/repo.git
    const httpsMatch = url.match(
      /https?:\/\/(?:api\.)?jjhub\.tech\/([^/]+)\/([^/]+?)(?:\.git)?$/,
    );
    if (httpsMatch) {
      return {
        owner: httpsMatch[1],
        repo: httpsMatch[2],
        fullName: `${httpsMatch[1]}/${httpsMatch[2]}`,
      };
    }
  }

  // Fallback: try any remote, not just jjhub.tech
  for (const line of urlLines) {
    const url = line.replace(/url\s*=\s*/, "").trim();

    const sshFallback = url.match(
      /git@[^:]+:([^/]+)\/([^/]+?)(?:\.git)?$/,
    );
    if (sshFallback) {
      return {
        owner: sshFallback[1],
        repo: sshFallback[2],
        fullName: `${sshFallback[1]}/${sshFallback[2]}`,
      };
    }

    const httpsFallback = url.match(
      /https?:\/\/[^/]+\/([^/]+)\/([^/]+?)(?:\.git)?$/,
    );
    if (httpsFallback) {
      return {
        owner: httpsFallback[1],
        repo: httpsFallback[2],
        fullName: `${httpsFallback[1]}/${httpsFallback[2]}`,
      };
    }
  }

  return undefined;
}
