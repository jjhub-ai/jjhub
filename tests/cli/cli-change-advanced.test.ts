import { expect, test } from "bun:test";
import {
  createWorkingCopyCommit,
  currentChangeId,
  initJjRepo,
  runCli,
  withSandbox,
} from "./helpers";

test("change diff shows diff for working copy", async () => {
  await withSandbox("jjhub-change-adv-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "Add file", [["hello.txt", "hello world\n"]]);

    const result = await runCli(["change", "diff", "--json"], {
      cwd: sandbox.root,
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(parsed.change_id).toBeDefined();
    expect(typeof parsed.diff).toBe("string");
  });
});

test("change diff with specific change ID", async () => {
  await withSandbox("jjhub-change-adv-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    const { changeId } = await createWorkingCopyCommit(sandbox.root, "First", [["a.txt", "a\n"]]);

    const result = await runCli(["change", "diff", changeId, "--json"], {
      cwd: sandbox.root,
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(parsed.change_id).toBe(changeId);
  });
});

test("change list json output", async () => {
  await withSandbox("jjhub-change-adv-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "Alpha", [["a.txt", "a\n"]]);
    await createWorkingCopyCommit(sandbox.root, "Beta", [["b.txt", "b\n"]]);

    const result = await runCli(["change", "list", "--json"], {
      cwd: sandbox.root,
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThanOrEqual(2);
  });
});

test("change show returns change details", async () => {
  await withSandbox("jjhub-change-adv-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    const { changeId } = await createWorkingCopyCommit(sandbox.root, "Show me", [["a.txt", "a\n"]]);

    const result = await runCli(["change", "show", changeId, "--json"], {
      cwd: sandbox.root,
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(parsed.change_id).toBe(changeId);
    expect(parsed.description).toBe("Show me");
  });
});

test("change files lists files in change", async () => {
  await withSandbox("jjhub-change-adv-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    const { changeId } = await createWorkingCopyCommit(sandbox.root, "Multi-file", [
      ["x.txt", "x\n"],
      ["y.txt", "y\n"],
    ]);

    const result = await runCli(["change", "files", changeId, "--json"], {
      cwd: sandbox.root,
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(parsed.change_id).toBe(changeId);
    expect(Array.isArray(parsed.files)).toBe(true);
    const files = parsed.files as string[];
    expect(files.length).toBeGreaterThanOrEqual(2);
  });
});
