/**
 * Build JJHub desktop app for macOS, Windows, and Linux using ElectroBun.
 *
 * Produces:
 *   macOS:   .app bundle + .dmg
 *   Windows: .exe installer
 *   Linux:   .AppImage
 *
 * Usage: bun run scripts/build-desktop.ts [--platform=<mac|win|linux>]
 *
 * By default builds for all platforms. Use --platform to build for a single one.
 */

import { mkdir, rm, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const DESKTOP_DIR = resolve(ROOT, "apps", "desktop");
const DIST = resolve(ROOT, "dist", "desktop");

type Platform = "mac" | "win" | "linux";

const ALL_PLATFORMS: Platform[] = ["mac", "win", "linux"];

function exec(cmd: string[], cwd: string, env?: Record<string, string>): void {
  const proc = Bun.spawnSync(cmd, {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, ...env },
  });
  if (proc.exitCode !== 0) {
    throw new Error(`Command failed (exit ${proc.exitCode}): ${cmd.join(" ")}`);
  }
}

function parseArgs(): Platform[] {
  const platformArg = process.argv.find((a) => a.startsWith("--platform="));
  if (platformArg) {
    const value = platformArg.split("=")[1] as Platform;
    if (!ALL_PLATFORMS.includes(value)) {
      console.error(
        `Invalid platform: ${value}. Must be one of: ${ALL_PLATFORMS.join(", ")}`,
      );
      process.exit(1);
    }
    return [value];
  }
  return [...ALL_PLATFORMS];
}

async function buildMac(): Promise<string[]> {
  console.log("  Building macOS .app bundle...");
  const bun = Bun.which("bun") ?? process.execPath;

  // ElectroBun builds the .app bundle
  exec([bun, "run", "build"], DESKTOP_DIR);

  const outputDir = resolve(DIST, "mac");
  await mkdir(outputDir, { recursive: true });

  // ElectroBun outputs to the desktop dist directory
  const electrobunDist = resolve(DESKTOP_DIR, "dist");

  // Copy the .app bundle
  const appName = "JJHub.app";
  const appSource = resolve(electrobunDist, appName);
  const appDest = resolve(outputDir, appName);

  exec(["cp", "-R", appSource, appDest], ROOT);

  // Create .dmg from the .app bundle
  console.log("  Creating .dmg...");
  const dmgPath = resolve(outputDir, "JJHub.dmg");
  exec(
    [
      "hdiutil",
      "create",
      "-volname",
      "JJHub",
      "-srcfolder",
      appDest,
      "-ov",
      "-format",
      "UDZO",
      dmgPath,
    ],
    ROOT,
  );

  return [appDest, dmgPath];
}

async function buildWindows(): Promise<string[]> {
  console.log("  Building Windows .exe installer...");
  const bun = Bun.which("bun") ?? process.execPath;

  exec([bun, "run", "build"], DESKTOP_DIR, {
    ELECTROBUN_TARGET: "win",
  });

  const outputDir = resolve(DIST, "win");
  await mkdir(outputDir, { recursive: true });

  const electrobunDist = resolve(DESKTOP_DIR, "dist");

  // Copy the installer executable
  const exeName = "JJHub-Setup.exe";
  const exeSource = resolve(electrobunDist, exeName);
  const exeDest = resolve(outputDir, exeName);

  exec(["cp", exeSource, exeDest], ROOT);

  return [exeDest];
}

async function buildLinux(): Promise<string[]> {
  console.log("  Building Linux .AppImage...");
  const bun = Bun.which("bun") ?? process.execPath;

  exec([bun, "run", "build"], DESKTOP_DIR, {
    ELECTROBUN_TARGET: "linux",
  });

  const outputDir = resolve(DIST, "linux");
  await mkdir(outputDir, { recursive: true });

  const electrobunDist = resolve(DESKTOP_DIR, "dist");

  // Copy the AppImage
  const appImageName = "JJHub.AppImage";
  const appImageSource = resolve(electrobunDist, appImageName);
  const appImageDest = resolve(outputDir, appImageName);

  exec(["cp", appImageSource, appImageDest], ROOT);

  // Make it executable
  exec(["chmod", "+x", appImageDest], ROOT);

  return [appImageDest];
}

async function main(): Promise<void> {
  const platforms = parseArgs();

  console.log("JJHub Desktop Build\n");
  console.log(`Platforms: ${platforms.join(", ")}\n`);

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  const results: Array<{ platform: Platform; artifacts: string[] }> = [];

  for (const platform of platforms) {
    console.log(`\n[${platform}]`);

    let artifacts: string[];
    switch (platform) {
      case "mac":
        artifacts = await buildMac();
        break;
      case "win":
        artifacts = await buildWindows();
        break;
      case "linux":
        artifacts = await buildLinux();
        break;
    }

    results.push({ platform, artifacts });
  }

  console.log("\n--- Desktop Build Summary ---");
  for (const r of results) {
    console.log(`  ${r.platform}:`);
    for (const a of r.artifacts) {
      console.log(`    ${a}`);
    }
  }
  console.log("\nDone.");
}

await main();
