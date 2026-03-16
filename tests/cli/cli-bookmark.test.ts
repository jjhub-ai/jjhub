import { expect, test } from "bun:test";
import {
  createBookmark,
  createWorkingCopyCommit,
  initJjRepo,
  runCli,
  withSandbox,
} from "./helpers";

test("bookmark list empty repo", async () => {
  await withSandbox("jjhub-bookmark-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    const result = await runCli(["bookmark", "list"], { cwd: sandbox.root });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("No bookmarks");
  });
});

test("bookmark list after create", async () => {
  await withSandbox("jjhub-bookmark-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "A", [["a.txt", "a\n"]]);
    await createBookmark(sandbox.root, "main");

    const result = await runCli(["bookmark", "list"], { cwd: sandbox.root });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("main");
  });
});

test("bookmark list json", async () => {
  await withSandbox("jjhub-bookmark-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "B", [["b.txt", "b\n"]]);
    await createBookmark(sandbox.root, "feature");

    const result = await runCli(["--json", "bookmark", "list"], {
      cwd: sandbox.root,
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.name).toBe("feature");
  });
});

test("bookmark list toon", async () => {
  await withSandbox("jjhub-bookmark-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "B", [["b.txt", "b\n"]]);
    await createBookmark(sandbox.root, "feature");

    const result = await runCli(["--toon", "bookmark", "list"], {
      cwd: sandbox.root,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(
      /^\[1\]\{name,target_change_id,target_commit_id\}:\n  feature,[a-z0-9]+,[a-f0-9]+\n?$/,
    );
  });
});

test("bookmark create succeeds", async () => {
  await withSandbox("jjhub-bookmark-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "Initial", [["init.txt", "hi\n"]]);

    const result = await runCli(["bookmark", "create", "my-feature"], {
      cwd: sandbox.root,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("my-feature");
  });
});

test("bookmark create then list", async () => {
  await withSandbox("jjhub-bookmark-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "C", [["c.txt", "c\n"]]);

    const create = await runCli(["bookmark", "create", "release-1.0"], {
      cwd: sandbox.root,
    });
    expect(create.exitCode).toBe(0);

    const list = await runCli(["bookmark", "list"], { cwd: sandbox.root });
    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain("release-1.0");
  });
});

test("bookmark create json output", async () => {
  await withSandbox("jjhub-bookmark-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "D", [["d.txt", "d\n"]]);

    const result = await runCli(["--json", "bookmark", "create", "json-bm"], {
      cwd: sandbox.root,
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout).name).toBe("json-bm");
  });
});

test("bookmark create toon output", async () => {
  await withSandbox("jjhub-bookmark-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "E", [["e.txt", "e\n"]]);

    const result = await runCli(["--toon", "bookmark", "create", "toon-bm"], {
      cwd: sandbox.root,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("name");
    expect(result.stdout).toContain("toon-bm");
  });
});

test("bookmark delete succeeds", async () => {
  await withSandbox("jjhub-bookmark-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "F", [["f.txt", "f\n"]]);
    await createBookmark(sandbox.root, "to-delete");

    const before = await runCli(["bookmark", "list"], { cwd: sandbox.root });
    expect(before.stdout).toContain("to-delete");

    const result = await runCli(["bookmark", "delete", "to-delete"], {
      cwd: sandbox.root,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("to-delete");
  });
});

test("bookmark delete then list removes it", async () => {
  await withSandbox("jjhub-bookmark-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "G", [["g.txt", "g\n"]]);
    await createBookmark(sandbox.root, "gone");

    const result = await runCli(["bookmark", "delete", "gone"], { cwd: sandbox.root });
    expect(result.exitCode).toBe(0);

    const list = await runCli(["bookmark", "list"], { cwd: sandbox.root });
    expect(list.exitCode).toBe(0);
    expect(list.stdout.includes("gone") && !list.stdout.includes("No bookmarks")).toBe(false);
  });
});

test("bookmark delete nonexistent fails", async () => {
  await withSandbox("jjhub-bookmark-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    const result = await runCli(["bookmark", "delete", "nonexistent-bm"], {
      cwd: sandbox.root,
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.trim().length).toBeGreaterThan(0);
  });
});

test("bookmark create outside repo fails", async () => {
  await withSandbox("jjhub-bookmark-", async (sandbox) => {
    const result = await runCli(["bookmark", "create", "test-bm"], {
      cwd: sandbox.root,
    });
    expect(result.exitCode).not.toBe(0);
  });
});

test("bookmark delete outside repo fails", async () => {
  await withSandbox("jjhub-bookmark-", async (sandbox) => {
    const result = await runCli(["bookmark", "delete", "test-bm"], {
      cwd: sandbox.root,
    });
    expect(result.exitCode).not.toBe(0);
  });
});

test("bookmark create multiple", async () => {
  await withSandbox("jjhub-bookmark-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "H", [["h.txt", "h\n"]]);

    for (const name of ["alpha", "beta", "gamma"]) {
      const result = await runCli(["bookmark", "create", name], { cwd: sandbox.root });
      expect(result.exitCode).toBe(0);
    }

    const list = await runCli(["bookmark", "list"], { cwd: sandbox.root });
    for (const name of ["alpha", "beta", "gamma"]) {
      expect(list.stdout).toContain(name);
    }
  });
});

test("bookmark delete silent with json flag", async () => {
  await withSandbox("jjhub-bookmark-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    await createWorkingCopyCommit(sandbox.root, "I", [["i.txt", "i\n"]]);
    await createBookmark(sandbox.root, "silent-del");

    const result = await runCli(["--json", "bookmark", "delete", "silent-del"], {
      cwd: sandbox.root,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("");
  });
});

test("bookmark create requires name arg", async () => {
  await withSandbox("jjhub-bookmark-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    const result = await runCli(["bookmark", "create"], { cwd: sandbox.root });

    expect(result.exitCode).not.toBe(0);
    expect(
      result.stderr.includes("name") ||
        result.stderr.includes("required") ||
        result.stderr.includes("Usage"),
    ).toBe(true);
  });
});

test("bookmark delete requires name arg", async () => {
  await withSandbox("jjhub-bookmark-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    const result = await runCli(["bookmark", "delete"], { cwd: sandbox.root });

    expect(result.exitCode).not.toBe(0);
    expect(
      result.stderr.includes("name") ||
        result.stderr.includes("required") ||
        result.stderr.includes("Usage"),
    ).toBe(true);
  });
});
