import { expect, test } from "bun:test";
import {
  createWorkingCopyCommit,
  initJjRepo,
  runCli,
  withSandbox,
} from "./helpers";

test("status in empty repo", async () => {
  await withSandbox("jjhub-status-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    const result = await runCli(["status"], { cwd: sandbox.root });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Working copy");
  });
});

test("status with modified file", async () => {
  await withSandbox("jjhub-status-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "Add hello", [["hello.txt", "hello\n"]]);

    const result = await runCli(["status"], { cwd: sandbox.root });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Working copy");
    expect(result.stdout).toContain("Add hello");
  });
});

test("status json flag", async () => {
  await withSandbox("jjhub-status-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    const result = await runCli(["status", "--format", "json"], { cwd: sandbox.root });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(typeof parsed.working_copy).toBe("object");
  });
});

test("status toon flag", async () => {
  await withSandbox("jjhub-status-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    const result = await runCli(["--toon", "status"], { cwd: sandbox.root });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(
      /^working_copy:\n  change_id: [a-z0-9]+\n  commit_id: [a-f0-9]+\n  description: ""\nparent:\n  change_id: [a-z0-9]+\n  commit_id: "[a-f0-9]+"\n  description: ""\nfiles\[0\]:\n?$/,
    );
  });
});

test("status outside repo errors", async () => {
  await withSandbox("jjhub-status-", async (sandbox) => {
    const result = await runCli(["status"], { cwd: sandbox.root });
    expect(result.exitCode).not.toBe(0);
  });
});
