import { expect, test } from "bun:test";
import { runCli, withSandbox, writeConfig } from "./helpers";

test("artifact list help shows description", async () => {
  await withSandbox("jjhub-artifact-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech");
    const result = await runCli(["artifact", "--help"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("artifact");
    expect(result.stdout).toContain("list");
    expect(result.stdout).toContain("download");
  });
});

test("artifact list subcommand exists", async () => {
  await withSandbox("jjhub-artifact-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech");
    const result = await runCli(["artifact", "list", "--help"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("list");
  });
});

test("artifact download subcommand exists", async () => {
  await withSandbox("jjhub-artifact-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech");
    const result = await runCli(["artifact", "download", "--help"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("download");
  });
});

test("artifact list requires runId argument", async () => {
  await withSandbox("jjhub-artifact-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech");
    const result = await runCli(["artifact", "list"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).not.toBe(0);
  });
});

test("artifact download requires runId and name arguments", async () => {
  await withSandbox("jjhub-artifact-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech");
    const result = await runCli(["artifact", "download"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).not.toBe(0);
  });
});
