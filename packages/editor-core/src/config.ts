/**
 * Configuration helpers for JJHub editor integrations.
 *
 * Reads JJHub config from standard locations and provides helpers to
 * extract daemon URL, auth token, and repo context from the config
 * or the local working directory.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ---- Config file types ----

export type JJHubConfig = {
  daemon?: {
    url?: string;
    port?: number;
  };
  auth?: {
    token?: string;
  };
  [key: string]: unknown;
};

export type RepoContext = {
  owner: string;
  repo: string;
};

// ---- Config file reading ----

/**
 * Standard config file paths, checked in order.
 */
function configFilePaths(): string[] {
  const home = homedir();
  return [
    join(home, ".config", "jjhub", "config.toml"),
    join(home, ".jjhub", "config.toml"),
  ];
}

/**
 * Read and parse the JJHub config file from standard locations.
 *
 * Supports a minimal TOML subset (flat key=value and [section] headers)
 * so we don't need a full TOML parser dependency.
 *
 * Returns null if no config file is found.
 */
export function readConfigFile(): JJHubConfig | null {
  for (const configPath of configFilePaths()) {
    if (existsSync(configPath)) {
      try {
        const raw = readFileSync(configPath, "utf-8");
        return parseMinimalToml(raw);
      } catch {
        // Config file exists but can't be read/parsed -- skip
        continue;
      }
    }
  }
  return null;
}

/**
 * Parse a minimal TOML file (flat key=value pairs and [section] headers).
 * This is intentionally simple -- we only need to read a handful of config
 * keys, not implement a full TOML spec.
 */
export function parseMinimalToml(input: string): JJHubConfig {
  const result: Record<string, Record<string, string>> = {};
  let currentSection = "__root__";
  result[currentSection] = {};

  for (const rawLine of input.split("\n")) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith("#")) continue;

    // Section header
    const sectionMatch = line.match(/^\[([a-zA-Z0-9_.-]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1]!;
      if (!result[currentSection]) result[currentSection] = {};
      continue;
    }

    // Key = value
    const kvMatch = line.match(/^([a-zA-Z0-9_.-]+)\s*=\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1]!;
      let value = kvMatch[2]!.trim();

      // Strip surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      result[currentSection]![key] = value;
    }
  }

  // Restructure into nested object
  const config: JJHubConfig = {};
  for (const [section, entries] of Object.entries(result)) {
    if (section === "__root__") {
      Object.assign(config, entries);
    } else {
      (config as Record<string, unknown>)[section] = { ...entries };
    }
  }

  return config;
}

// ---- Token resolution ----

/**
 * Resolve the auth token from (in priority order):
 * 1. JJHUB_TOKEN environment variable
 * 2. Config file auth.token field
 * 3. null (unauthenticated)
 */
export function getToken(): string | null {
  const envToken = process.env["JJHUB_TOKEN"];
  if (envToken) return envToken;

  const config = readConfigFile();
  if (config?.auth?.token) return config.auth.token as string;

  return null;
}

// ---- Repo context detection ----

/**
 * Detect the current repository context from the working directory.
 *
 * Looks for a `.jj` directory and reads repo metadata to extract
 * the owner/repo pair. Falls back to parsing the directory name
 * if metadata isn't available.
 *
 * @param cwd - The working directory to inspect (defaults to process.cwd())
 * @returns RepoContext if detected, null otherwise
 */
export function detectRepoContext(cwd?: string): RepoContext | null {
  const dir = cwd ?? process.cwd();

  // Look for .jj/repo directory which indicates a jj repository
  const jjRepoDir = join(dir, ".jj", "repo");
  if (!existsSync(jjRepoDir)) return null;

  // Try to read the store config for remote info
  const storeConfigPath = join(jjRepoDir, "store", "config");
  if (existsSync(storeConfigPath)) {
    try {
      const storeConfig = readFileSync(storeConfigPath, "utf-8");
      const remoteMatch = storeConfig.match(
        /jjhub\.tech[:/]([^/\s]+)\/([^/\s.]+)/,
      );
      if (remoteMatch) {
        return {
          owner: remoteMatch[1]!,
          repo: remoteMatch[2]!.replace(/\.git$/, ""),
        };
      }
    } catch {
      // Fall through to directory name heuristic
    }
  }

  // Try .jj/repo/git config if it's a colocated repo
  const gitConfigPath = join(dir, ".jj", "repo", "store", "git_config");
  if (existsSync(gitConfigPath)) {
    try {
      const gitConfig = readFileSync(gitConfigPath, "utf-8");
      const remoteMatch = gitConfig.match(
        /jjhub\.tech[:/]([^/\s]+)\/([^/\s.]+)/,
      );
      if (remoteMatch) {
        return {
          owner: remoteMatch[1]!,
          repo: remoteMatch[2]!.replace(/\.git$/, ""),
        };
      }
    } catch {
      // Fall through
    }
  }

  // Also check standard git remote config for colocated repos
  const gitDir = join(dir, ".git");
  if (existsSync(join(gitDir, "config"))) {
    try {
      const gitConfig = readFileSync(join(gitDir, "config"), "utf-8");
      const remoteMatch = gitConfig.match(
        /jjhub\.tech[:/]([^/\s]+)\/([^/\s.]+)/,
      );
      if (remoteMatch) {
        return {
          owner: remoteMatch[1]!,
          repo: remoteMatch[2]!.replace(/\.git$/, ""),
        };
      }
    } catch {
      // Fall through
    }
  }

  return null;
}

/**
 * Get the daemon URL from config or environment.
 * Re-exported from config for convenience (canonical implementation is in daemon.ts).
 */
export function getDaemonUrlFromConfig(): string | null {
  const envUrl = process.env["JJHUB_DAEMON_URL"];
  if (envUrl) return envUrl;

  const config = readConfigFile();
  if (config?.daemon?.url) return config.daemon.url as string;

  return null;
}
