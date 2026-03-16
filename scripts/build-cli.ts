/**
 * Build JJHub CLI binary for all platforms.
 *
 * The CLI is the main user-facing binary that includes `serve`, `daemon`,
 * and all other commands. This script produces a standalone binary per
 * platform and packages each with a README into a tarball or zip.
 *
 * Usage: bun run scripts/build-cli.ts [--current-only]
 */

import { mkdir, rm, copyFile, writeFile } from "node:fs/promises";
import { resolve, basename } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const DIST = resolve(ROOT, "dist", "cli");
const CLI_ENTRY = "apps/cli/src/main.ts";

const ALL_TARGETS = [
  { bun: "bun-darwin-arm64", name: "jjhub-cli-darwin-arm64", ext: "" },
  { bun: "bun-darwin-x64", name: "jjhub-cli-darwin-x64", ext: "" },
  { bun: "bun-linux-x64", name: "jjhub-cli-linux-x64", ext: "" },
  { bun: "bun-linux-arm64", name: "jjhub-cli-linux-arm64", ext: "" },
  { bun: "bun-windows-x64", name: "jjhub-cli-windows-x64", ext: ".exe" },
] as const;

function currentPlatformTarget(): (typeof ALL_TARGETS)[number] | undefined {
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  const os =
    process.platform === "darwin"
      ? "darwin"
      : process.platform === "win32"
        ? "windows"
        : "linux";
  return ALL_TARGETS.find((t) => t.bun === `bun-${os}-${arch}`);
}

function exec(cmd: string[], cwd: string): void {
  const proc = Bun.spawnSync(cmd, {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`Command failed (exit ${proc.exitCode}): ${cmd.join(" ")}`);
  }
}

async function buildTarget(
  target: (typeof ALL_TARGETS)[number],
): Promise<{ binary: string; archive: string }> {
  const binDir = resolve(DIST, "bin");
  await mkdir(binDir, { recursive: true });

  const outfile = resolve(binDir, `${target.name}${target.ext}`);
  const bun = Bun.which("bun") ?? process.execPath;

  console.log(`  Compiling ${target.bun}...`);
  exec(
    [
      bun,
      "build",
      "--compile",
      "--minify",
      `--target=${target.bun}`,
      CLI_ENTRY,
      "--outfile",
      outfile,
    ],
    ROOT,
  );

  // Package into archive
  const stagingDir = resolve(DIST, "staging", target.name);
  await rm(stagingDir, { recursive: true, force: true });
  await mkdir(stagingDir, { recursive: true });

  const binaryDest = resolve(stagingDir, `jjhub${target.ext}`);
  await copyFile(outfile, binaryDest);

  await writeFile(
    resolve(stagingDir, "README.txt"),
    [
      "JJHub CLI",
      "=========",
      "",
      "jj-native code hosting platform.",
      "",
      "Usage:",
      `  ./jjhub${target.ext} --help          # Show all commands`,
      `  ./jjhub${target.ext} serve           # Start the server`,
      `  ./jjhub${target.ext} daemon start    # Start background daemon`,
      `  ./jjhub${target.ext} repo list       # List repositories`,
      `  ./jjhub${target.ext} lr create       # Create a landing request`,
      "",
      "Docs: https://jjhub.tech/docs",
      "",
    ].join("\n"),
  );

  const archivesDir = resolve(DIST, "archives");
  await mkdir(archivesDir, { recursive: true });

  const isWindows = target.bun.includes("windows");
  let archivePath: string;

  if (isWindows) {
    archivePath = resolve(archivesDir, `${target.name}.zip`);
    exec(
      ["zip", "-j", archivePath, binaryDest, resolve(stagingDir, "README.txt")],
      stagingDir,
    );
  } else {
    archivePath = resolve(archivesDir, `${target.name}.tar.gz`);
    exec(
      [
        "tar",
        "czf",
        archivePath,
        "-C",
        resolve(stagingDir, ".."),
        basename(stagingDir),
      ],
      ROOT,
    );
  }

  return { binary: outfile, archive: archivePath };
}

async function main(): Promise<void> {
  const currentOnly = process.argv.includes("--current-only");

  console.log("JJHub CLI Build\n");

  await rm(DIST, { recursive: true, force: true });

  let targets: readonly (typeof ALL_TARGETS)[number][];

  if (currentOnly) {
    const t = currentPlatformTarget();
    if (!t) {
      console.error("Could not detect current platform target");
      process.exit(1);
    }
    targets = [t];
    console.log(`Building for current platform only: ${t.bun}`);
  } else {
    targets = ALL_TARGETS;
    console.log("Building for all platforms...");
  }

  const results: Array<{ target: string; archive: string }> = [];

  for (const target of targets) {
    console.log(`\n[${target.name}]`);
    const { archive } = await buildTarget(target);
    results.push({ target: target.name, archive });
  }

  // Clean staging
  await rm(resolve(DIST, "staging"), { recursive: true, force: true });

  console.log("\n--- CLI Build Summary ---");
  for (const r of results) {
    console.log(`  ${r.target} -> ${r.archive}`);
  }
  console.log("\nDone.");
}

await main();
