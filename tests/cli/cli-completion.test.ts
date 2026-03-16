import { expect, test } from "bun:test";
import { runCli, withSandbox } from "./helpers";

test("completion bash generates output", async () => {
  await withSandbox("jjhub-completion-", async (sandbox) => {
    const result = await runCli(["completion", "bash"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(0);
    expect(result.stdout.includes("jjhub") || result.stdout.includes("complete")).toBe(true);
  });
});

test("completion zsh generates output", async () => {
  await withSandbox("jjhub-completion-", async (sandbox) => {
    const result = await runCli(["completion", "zsh"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(0);
    expect(
      result.stdout.includes("jjhub") ||
        result.stdout.includes("compdef") ||
        result.stdout.includes("_arguments"),
    ).toBe(true);
  });
});

test("completion fish generates output", async () => {
  await withSandbox("jjhub-completion-", async (sandbox) => {
    const result = await runCli(["completion", "fish"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(0);
    expect(result.stdout).toContain("jjhub");
  });
});

test("completion bash includes all top level commands", async () => {
  await withSandbox("jjhub-completion-", async (sandbox) => {
    const result = await runCli(["completion", "bash"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).toBe(0);
    for (const command of [
      "auth",
      "repo",
      "issue",
      "land",
      "change",
      "bookmark",
      "status",
      "search",
      "workflow",
      "run",
      "agent",
      "ssh-key",
      "secret",
      "variable",
      "label",
      "config",
      "api",
      "completion",
    ]) {
      expect(result.stdout).toContain(command);
    }
  });
});

test("completion includes agent session migration surface", async () => {
  await withSandbox("jjhub-completion-", async (sandbox) => {
    const result = await runCli(["completion", "bash"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('agent)');
    expect(result.stdout).toContain('session list view run chat');
  });
});
