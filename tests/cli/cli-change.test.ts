import { expect, test } from "bun:test";
import {
  createWorkingCopyCommit,
  currentChangeId,
  initJjRepo,
  runCli,
  withSandbox,
} from "./helpers";

test("change list shows initial", async () => {
  await withSandbox("jjhub-change-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    const result = await runCli(["change", "list"], { cwd: sandbox.root });

    expect(result.exitCode).toBe(0);
  });
});

test("change list after commits", async () => {
  await withSandbox("jjhub-change-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "Alpha", [["a.txt", "a\n"]]);
    await createWorkingCopyCommit(sandbox.root, "Beta", [["b.txt", "b\n"]]);

    const result = await runCli(["change", "list"], { cwd: sandbox.root });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Alpha");
    expect(result.stdout).toContain("Beta");
  });
});

test("change list limit", async () => {
  await withSandbox("jjhub-change-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "A", [["a.txt", "a\n"]]);
    await createWorkingCopyCommit(sandbox.root, "B", [["b.txt", "b\n"]]);
    await createWorkingCopyCommit(sandbox.root, "C", [["c.txt", "c\n"]]);

    const result = await runCli(["change", "list", "--limit", "1"], {
      cwd: sandbox.root,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim().split("\n")).toHaveLength(1);
  });
});

test("change list json", async () => {
  await withSandbox("jjhub-change-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "Test", [["a.txt", "a\n"]]);

    const result = await runCli(["--json", "change", "list"], { cwd: sandbox.root });

    expect(result.exitCode).toBe(0);
    expect(Array.isArray(JSON.parse(result.stdout))).toBe(true);
  });
});

test("change list toon", async () => {
  await withSandbox("jjhub-change-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "TOON change", [["a.txt", "a\n"]]);

    const result = await runCli(["--toon", "change", "list"], { cwd: sandbox.root });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(
      /^\[2\]\{change_id,description\}:\n  [a-z0-9]+,TOON change\n  [a-z0-9]+,""\n?$/,
    );
  });
});

test("show existing", async () => {
  await withSandbox("jjhub-change-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    const commit = await createWorkingCopyCommit(sandbox.root, "My change", [["a.txt", "a\n"]]);

    const result = await runCli(["change", "show", commit.changeId], {
      cwd: sandbox.root,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("My change");
  });
});

test("show prefix match", async () => {
  await withSandbox("jjhub-change-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    const commit = await createWorkingCopyCommit(sandbox.root, "Prefix test", [["a.txt", "a\n"]]);

    const result = await runCli(["change", "show", commit.changeId.slice(0, 4)], {
      cwd: sandbox.root,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Prefix test");
  });
});

test("show invalid id", async () => {
  await withSandbox("jjhub-change-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    const result = await runCli(["change", "show", "!!invalid!!"], {
      cwd: sandbox.root,
    });
    expect(result.exitCode).not.toBe(0);
  });
});

test("diff working copy", async () => {
  await withSandbox("jjhub-change-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "Add file", [["hello.txt", "hello\n"]]);

    const result = await runCli(["change", "diff"], { cwd: sandbox.root });

    expect(result.exitCode).toBe(0);
  });
});

test("diff specific change", async () => {
  await withSandbox("jjhub-change-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "Diffable", [["x.txt", "x\n"]]);
    const changeId = await currentChangeId(sandbox.root);

    const result = await runCli(["change", "diff", changeId], {
      cwd: sandbox.root,
    });

    expect(result.exitCode).toBe(0);
  });
});

test("diff json", async () => {
  await withSandbox("jjhub-change-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "D", [["d.txt", "d\n"]]);

    const result = await runCli(["--json", "change", "diff"], { cwd: sandbox.root });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(typeof parsed.change_id).toBe("string");
  });
});
