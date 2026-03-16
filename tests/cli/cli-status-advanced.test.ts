import { expect, test } from "bun:test";
import {
  createWorkingCopyCommit,
  initJjRepo,
  runCli,
  withSandbox,
} from "./helpers";

test("status in empty repo shows working copy", async () => {
  await withSandbox("jjhub-status-adv-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    const result = await runCli(["status"], { cwd: sandbox.root });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Working copy");
  });
});

test("status json output has working_copy field", async () => {
  await withSandbox("jjhub-status-adv-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    const result = await runCli(["status", "--json"], { cwd: sandbox.root });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(typeof parsed.working_copy).toBe("object");
  });
});

test("status json output includes parent", async () => {
  await withSandbox("jjhub-status-adv-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "Add something", [["a.txt", "a\n"]]);

    const result = await runCli(["status", "--json"], { cwd: sandbox.root });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(parsed.working_copy).toBeDefined();
    expect(parsed.parent).toBeDefined();
  });
});

test("status with files shows file list", async () => {
  await withSandbox("jjhub-status-adv-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "Multi-file", [
      ["x.txt", "x\n"],
      ["y.txt", "y\n"],
    ]);

    const result = await runCli(["status"], { cwd: sandbox.root });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Working copy");
    expect(result.stdout).toContain("Multi-file");
  });
});

test("status toon output includes change_id", async () => {
  await withSandbox("jjhub-status-adv-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    const result = await runCli(["--toon", "status"], { cwd: sandbox.root });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("working_copy:");
    expect(result.stdout).toContain("change_id:");
  });
});
