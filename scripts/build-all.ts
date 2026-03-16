/**
 * Build all JJHub platform binaries (server + CLI) for distribution.
 *
 * Produces tarballs (.tar.gz) for macOS/Linux and zip files for Windows,
 * each containing the server binary and a README.
 *
 * Usage: bun run scripts/build-all.ts
 */

import { mkdir, rm, copyFile, writeFile } from "node:fs/promises";
import { resolve, basename } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const DIST = resolve(ROOT, "dist");

const TARGETS = [
  { bun: "bun-darwin-arm64", name: "jjhub-darwin-arm64", ext: "" },
  { bun: "bun-darwin-x64", name: "jjhub-darwin-x64", ext: "" },
  { bun: "bun-linux-x64", name: "jjhub-linux-x64", ext: "" },
  { bun: "bun-linux-arm64", name: "jjhub-linux-arm64", ext: "" },
  { bun: "bun-windows-x64", name: "jjhub-windows-x64", ext: ".exe" },
] as const;

interface BuildResult {
  target: string;
  binary: string;
  archive: string;
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

async function buildServerBinary(
  target: (typeof TARGETS)[number],
): Promise<string> {
  const outfile = resolve(DIST, "bin", `${target.name}-server${target.ext}`);
  const bun = Bun.which("bun") ?? process.execPath;

  console.log(`  Building server for ${target.bun}...`);
  exec(
    [
      bun,
      "build",
      "--compile",
      "--minify",
      `--target=${target.bun}`,
      "apps/server/src/index.ts",
      "--outfile",
      outfile,
    ],
    ROOT,
  );

  return outfile;
}

async function buildCliBinary(
  target: (typeof TARGETS)[number],
): Promise<string> {
  const outfile = resolve(DIST, "bin", `${target.name}-cli${target.ext}`);
  const bun = Bun.which("bun") ?? process.execPath;

  console.log(`  Building CLI for ${target.bun}...`);
  exec(
    [
      bun,
      "build",
      "--compile",
      "--minify",
      `--target=${target.bun}`,
      "apps/cli/src/main.ts",
      "--outfile",
      outfile,
    ],
    ROOT,
  );

  return outfile;
}

async function createArchive(
  target: (typeof TARGETS)[number],
  serverBinary: string,
  cliBinary: string,
): Promise<string> {
  const stagingDir = resolve(DIST, "staging", target.name);
  await rm(stagingDir, { recursive: true, force: true });
  await mkdir(stagingDir, { recursive: true });

  // Copy binaries with clean names
  const serverDest = resolve(stagingDir, `jjhub-server${target.ext}`);
  const cliDest = resolve(stagingDir, `jjhub${target.ext}`);
  await copyFile(serverBinary, serverDest);
  await copyFile(cliBinary, cliDest);

  // Write a platform README
  await writeFile(
    resolve(stagingDir, "README.txt"),
    [
      "JJHub",
      "=====",
      "",
      "jj-native code hosting platform.",
      "",
      "Binaries:",
      `  jjhub${target.ext}         - CLI (includes serve, daemon, and all user commands)`,
      `  jjhub-server${target.ext}  - Standalone server binary`,
      "",
      "Quick start:",
      `  ./jjhub${target.ext} serve        # Start the server`,
      `  ./jjhub${target.ext} --help       # Show all commands`,
      "",
      "Docs: https://jjhub.tech/docs",
      "",
    ].join("\n"),
  );

  const archivesDir = resolve(DIST, "archives");
  await mkdir(archivesDir, { recursive: true });

  const isWindows = target.bun.includes("windows");

  if (isWindows) {
    const archivePath = resolve(archivesDir, `${target.name}.zip`);
    exec(
      ["zip", "-j", archivePath, serverDest, cliDest, resolve(stagingDir, "README.txt")],
      stagingDir,
    );
    return archivePath;
  }

  const archivePath = resolve(archivesDir, `${target.name}.tar.gz`);
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
  return archivePath;
}

async function main(): Promise<void> {
  console.log("JJHub Build — All Platforms\n");

  // Clean previous build
  await rm(DIST, { recursive: true, force: true });
  await mkdir(resolve(DIST, "bin"), { recursive: true });

  const results: BuildResult[] = [];

  for (const target of TARGETS) {
    console.log(`\n[${target.name}]`);

    const serverBinary = await buildServerBinary(target);
    const cliBinary = await buildCliBinary(target);
    const archive = await createArchive(target, serverBinary, cliBinary);

    results.push({ target: target.name, binary: serverBinary, archive });
    console.log(`  Archive: ${archive}`);
  }

  // Clean up staging
  await rm(resolve(DIST, "staging"), { recursive: true, force: true });

  console.log("\n--- Build Summary ---");
  for (const r of results) {
    console.log(`  ${r.target} -> ${r.archive}`);
  }
  console.log("\nDone.");
}

await main();
