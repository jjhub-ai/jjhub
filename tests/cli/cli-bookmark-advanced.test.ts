import { expect, test } from "bun:test";
import {
  createBookmark,
  createWorkingCopyCommit,
  initJjRepo,
  runCli,
  withSandbox,
} from "./helpers";

test("bookmark create in repo", async () => {
  await withSandbox("jjhub-bm-adv-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "First commit", [["a.txt", "a\n"]]);

    const result = await runCli(["bookmark", "create", "feature-1"], {
      cwd: sandbox.root,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Created bookmark feature-1");
  });
});

test("bookmark create json output", async () => {
  await withSandbox("jjhub-bm-adv-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "Initial", [["a.txt", "a\n"]]);

    const result = await runCli(["bookmark", "create", "release-1", "--json"], {
      cwd: sandbox.root,
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(parsed.name).toBe("release-1");
  });
});

test("bookmark list json output", async () => {
  await withSandbox("jjhub-bm-adv-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "A", [["a.txt", "a\n"]]);
    await createBookmark(sandbox.root, "main");
    await createBookmark(sandbox.root, "develop");

    const result = await runCli(["bookmark", "list", "--json"], {
      cwd: sandbox.root,
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThanOrEqual(2);
  });
});

test("bookmark delete removes bookmark", async () => {
  await withSandbox("jjhub-bm-adv-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "A", [["a.txt", "a\n"]]);
    await createBookmark(sandbox.root, "temp");

    const result = await runCli(["bookmark", "delete", "temp"], {
      cwd: sandbox.root,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Deleted bookmark temp");

    const listResult = await runCli(["bookmark", "list"], {
      cwd: sandbox.root,
    });
    expect(listResult.stdout).not.toContain("temp");
  });
});

test("bookmark delete nonexistent fails", async () => {
  await withSandbox("jjhub-bm-adv-", async (sandbox) => {
    await initJjRepo(sandbox.root);

    const result = await runCli(["bookmark", "delete", "nonexistent"], {
      cwd: sandbox.root,
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("not found");
  });
});
