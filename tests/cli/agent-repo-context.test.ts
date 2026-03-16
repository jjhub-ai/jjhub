import { expect, test } from "bun:test";
import { realpathSync } from "node:fs";
import { collectRepoContext } from "../src/agent/repo-context";
import { initJjRepo, runJj, withSandbox, writeConfig } from "./helpers";

async function withProcessEnv<T>(
  env: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(env)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("collectRepoContext detects repo slug from JJHub remote", async () => {
  await withSandbox("jjhub-agent-context-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    const remote = await runJj(
      ["git", "remote", "add", "origin", "git@ssh.jjhub.tech:alice/demo.git"],
      { cwd: sandbox.root },
    );
    expect(remote.exitCode).toBe(0);

    const context = await withProcessEnv(
      {
        HOME: sandbox.cfgHome,
        JJHUB_DISABLE_SYSTEM_KEYRING: "1",
        XDG_CONFIG_HOME: sandbox.cfgHome,
      },
      () => collectRepoContext({ cwd: sandbox.root }),
    );

    expect(context.repoRoot).toBe(realpathSync(sandbox.root));
    expect(context.repoSlug).toBe("alice/demo");
    expect(context.repoSource).toBe("detected");
    expect(context.jjRemotes.ok).toBe(true);
  });
});

test("collectRepoContext skips remote repo check when auth is missing", async () => {
  await withSandbox("jjhub-agent-context-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    const remote = await runJj(
      ["git", "remote", "add", "origin", "git@ssh.jjhub.tech:alice/demo.git"],
      { cwd: sandbox.root },
    );
    expect(remote.exitCode).toBe(0);
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech", "");

    const context = await withProcessEnv(
      {
        HOME: sandbox.cfgHome,
        JJHUB_DISABLE_SYSTEM_KEYRING: "1",
        XDG_CONFIG_HOME: sandbox.cfgHome,
        JJHUB_TOKEN: undefined,
      },
      () => collectRepoContext({ cwd: sandbox.root, repoOverride: "alice/demo" }),
    );

    expect(context.auth.loggedIn).toBe(false);
    expect(context.remoteRepo.checked).toBe(false);
    expect(context.remoteRepo.message).toContain("auth");
  });
});
