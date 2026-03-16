/**
 * Auto-start helpers for JJHub editor integrations.
 *
 * Provides functions to locate the `jjhub` CLI binary and generate
 * platform-specific install instructions when it is missing.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";

/**
 * Common install locations for the jjhub binary, checked in order
 * after PATH lookup fails.
 */
function commonBinaryPaths(): string[] {
  const home = homedir();
  const os = platform();

  const paths = [
    join(home, ".jjhub", "bin", "jjhub"),
    join(home, ".local", "bin", "jjhub"),
  ];

  if (os === "darwin") {
    paths.push("/opt/homebrew/bin/jjhub");
    paths.push("/usr/local/bin/jjhub");
  } else if (os === "linux") {
    paths.push("/usr/local/bin/jjhub");
    paths.push("/usr/bin/jjhub");
    paths.push(join(home, ".cargo", "bin", "jjhub"));
  } else if (os === "win32") {
    const appData = process.env["APPDATA"] ?? join(home, "AppData", "Roaming");
    paths.push(join(appData, "jjhub", "bin", "jjhub.exe"));
    paths.push(join(home, ".jjhub", "bin", "jjhub.exe"));
  }

  return paths;
}

/**
 * Try to find the `jjhub` binary on the system.
 *
 * Resolution order:
 *  1. The `which`/`where` command (checks PATH)
 *  2. Common install locations (platform-specific)
 *
 * @returns The absolute path to the jjhub binary, or null if not found.
 */
export function findJJHubBinary(): string | null {
  // 1. Check PATH via which/where
  try {
    const cmd = platform() === "win32" ? "where" : "which";
    const result = Bun.spawnSync([cmd, "jjhub"], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    const output = result.stdout.toString().trim();
    if (result.exitCode === 0 && output) {
      // `which` may return multiple lines; take the first
      const firstLine = output.split("\n")[0]!.trim();
      if (firstLine && existsSync(firstLine)) {
        return firstLine;
      }
    }
  } catch {
    // which/where not available or failed — fall through
  }

  // 2. Check common install locations
  for (const candidate of commonBinaryPaths()) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Check whether the jjhub CLI is installed anywhere on the system.
 */
export function isInstalled(): boolean {
  return findJJHubBinary() !== null;
}

/**
 * Return platform-specific install instructions for the jjhub CLI.
 */
export function getInstallInstructions(): string {
  const os = platform();

  if (os === "darwin") {
    return [
      "Install the JJHub CLI:",
      "",
      "  brew install jjhub-ai/tap/jjhub",
      "",
      "Or download from https://jjhub.tech/docs/cli/install",
    ].join("\n");
  }

  if (os === "linux") {
    return [
      "Install the JJHub CLI:",
      "",
      "  curl -fsSL https://jjhub.tech/install.sh | sh",
      "",
      "Or download from https://jjhub.tech/docs/cli/install",
    ].join("\n");
  }

  if (os === "win32") {
    return [
      "Install the JJHub CLI:",
      "",
      "  winget install jjhub-ai.jjhub",
      "",
      "Or download from https://jjhub.tech/docs/cli/install",
    ].join("\n");
  }

  return "Download the JJHub CLI from https://jjhub.tech/docs/cli/install";
}
