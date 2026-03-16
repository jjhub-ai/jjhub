import { expect, test } from "bun:test";
import {
  createMockServer,
  createWorkingCopyCommit,
  expectHeader,
  expectJsonBody,
  initJjRepo,
  setWorkingCopy,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

function landing(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    number: 42,
    title: "Demo",
    body: "",
    state: "open",
    author: { id: 1, login: "alice" },
    change_ids: ["k1"],
    target_bookmark: "main",
    conflict_status: "clean",
    stack_size: 1,
    created_at: "2026-02-19T00:00:00Z",
    updated_at: "2026-02-19T00:00:00Z",
    ...overrides,
  };
}

test("land create posts request and prints number and url", async () => {
  await withSandbox("jjhub-land-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/landings",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expectJsonBody(bodyText, {
            title: "My change",
            target_bookmark: "main",
            change_ids: ["kseed001"],
          });
        },
        response: {
          status: 201,
          json: landing({
            number: 42,
            title: "My change",
            change_ids: ["kseed001"],
          }),
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        [
          "land",
          "create",
          "-R",
          "alice/demo",
          "--title",
          "My change",
          "--target",
          "main",
          "--change-id",
          "kseed001",
        ],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("42");
      expect(result.stdout).toContain("/alice/demo/landings/42");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("land create auto detects current change id", async () => {
  await withSandbox("jjhub-land-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    const workingCopy = await createWorkingCopyCommit(sandbox.root, "Auto detect", [
      ["a.txt", "a\n"],
    ]);

    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/landings",
        assert({ bodyText }) {
          expectJsonBody(bodyText, {
            title: "Auto detect",
            target_bookmark: "main",
            change_ids: [workingCopy.changeId],
          });
        },
        response: {
          status: 201,
          json: landing({
            number: 7,
            title: "Auto detect",
            change_ids: ["kseed001"],
          }),
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["land", "create", "-R", "alice/demo", "--title", "Auto detect", "--target", "main"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("land create stack sends multiple change ids", async () => {
  await withSandbox("jjhub-land-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    const base = await createWorkingCopyCommit(sandbox.root, "Base", [["a.txt", "a\n"]]);
    const top = await createWorkingCopyCommit(
      sandbox.root,
      "Top",
      [["b.txt", "b\n"]],
      { baseRev: base.commitId },
    );
    await createWorkingCopyCommit(
      sandbox.root,
      "Unrelated",
      [["z.txt", "z\n"]],
      { baseRev: "root()" },
    );
    await setWorkingCopy(sandbox.root, top.commitId);

    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/landings",
        assert({ bodyText }) {
          const parsed = expectJsonBody<Record<string, unknown>>(bodyText, {
            title: "Stack",
            target_bookmark: "main",
          });
          expect(parsed.change_ids).toEqual([top.changeId, base.changeId]);
        },
        response: {
          status: 201,
          json: landing({
            number: 8,
            title: "Stack",
            change_ids: ["k1", "k2"],
            stack_size: 2,
          }),
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["land", "create", "-R", "alice/demo", "--title", "Stack", "--target", "main", "--stack"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("land list defaults to open and renders table", async () => {
  await withSandbox("jjhub-land-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/landings",
        assert({ query }) {
          expect(query.get("page")).toBe("1");
          expect(query.get("per_page")).toBe("30");
          expect(query.get("state")).toBe("open");
        },
        response: {
          json: [landing({ number: 5, title: "Demo", change_ids: ["k1"] })],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["land", "list", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Demo");
      expect(result.stdout.toLowerCase()).toContain("number");
      expect(result.stdout.toLowerCase()).toContain("change_ids");
      expect(result.stdout).toContain("k1");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("land list json field filtering keeps requested fields", async () => {
  await withSandbox("jjhub-land-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/landings",
        response: {
          json: [
            landing({
              number: 5,
              title: "Demo",
              body: "ignore",
              state: "open",
              change_ids: ["k1"],
            }),
          ],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["land", "list", "-R", "alice/demo", "--json", "number,title,state"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(parsed[0]?.number).toBe(5);
      expect(parsed[0]?.title).toBe("Demo");
      expect(parsed[0]?.state).toBe("open");
      expect(parsed[0]?.body).toBeUndefined();
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("land list toon output", async () => {
  await withSandbox("jjhub-land-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/landings",
        response: {
          json: [landing({ number: 5, title: "Demo item", body: "ignore" })],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["land", "list", "-R", "alice/demo", "--toon"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(
        [
          "[1]:",
          "  - number: 5",
          "    title: Demo item",
          "    body: ignore",
          "    state: open",
          "    author:",
          "      id: 1",
          "      login: alice",
          "    change_ids[1]: k1",
          "    target_bookmark: main",
          "    conflict_status: clean",
          "    stack_size: 1",
          '    created_at: "2026-02-19T00:00:00Z"',
          '    updated_at: "2026-02-19T00:00:00Z"',
          "",
        ].join("\n"),
      );
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("land view fetches details changes reviews and conflicts", async () => {
  await withSandbox("jjhub-land-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/landings/42",
        response: { json: landing({ number: 42, body: "body" }) },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/landings/42/changes",
        assert({ query }) {
          expect(query.get("page")).toBe("1");
          expect(query.get("per_page")).toBe("100");
        },
        response: {
          json: [
            {
              id: 1,
              landing_request_id: 42,
              change_id: "k1",
              position_in_stack: 1,
              created_at: "2026-02-19T00:00:00Z",
            },
          ],
        },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/landings/42/reviews",
        assert({ query }) {
          expect(query.get("page")).toBe("1");
          expect(query.get("per_page")).toBe("100");
        },
        response: {
          json: [
            {
              id: 1,
              landing_request_id: 42,
              reviewer_id: 2,
              type: "comment",
              body: "LGTM",
              state: "submitted",
              created_at: "2026-02-19T00:00:00Z",
              updated_at: "2026-02-19T00:00:00Z",
            },
          ],
        },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/landings/42/conflicts",
        response: {
          json: {
            conflict_status: "clean",
            has_conflicts: false,
            conflicts_by_change: {},
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["land", "view", "42", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Demo");
      expect(result.stdout).toContain("k1");
      expect(result.stdout).toContain("LGTM");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("land review approve posts review type", async () => {
  await withSandbox("jjhub-land-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/landings/42/reviews",
        assert({ bodyText }) {
          expectJsonBody(bodyText, {
            type: "approve",
            body: "LGTM",
          });
        },
        response: {
          status: 201,
          json: {
            id: 1,
            landing_request_id: 42,
            reviewer_id: 2,
            type: "approve",
            body: "LGTM",
            state: "submitted",
            created_at: "2026-02-19T00:00:00Z",
            updated_at: "2026-02-19T00:00:00Z",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["land", "review", "42", "-R", "alice/demo", "--approve", "--body", "LGTM"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("land land calls land endpoint", async () => {
  await withSandbox("jjhub-land-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PUT",
        path: "/api/repos/alice/demo/landings/42/land",
        response: {
          json: landing({ number: 42, state: "merged" }),
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["land", "land", "42", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toLowerCase()).toContain("landed");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("land checks fetches statuses", async () => {
  await withSandbox("jjhub-land-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/landings/42",
        response: {
          json: landing({ number: 42, change_ids: ["kseed001"] }),
        },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/commits/kseed001/statuses",
        response: {
          json: [
            {
              context: "ci/test",
              status: "success",
              description: "All checks passed",
              target_url: "https://ci.example/test",
            },
          ],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["land", "checks", "42", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("ci/test");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("land list without repo uses origin remote auto detection", async () => {
  await withSandbox("jjhub-land-", async (sandbox) => {
    const init = Bun.spawnSync(["git", "init", "-q"], { cwd: sandbox.root });
    expect(init.exitCode).toBe(0);
    const remote = Bun.spawnSync(
      ["git", "remote", "add", "origin", "git@jjhub.tech:alice/demo.git"],
      { cwd: sandbox.root },
    );
    expect(remote.exitCode).toBe(0);

    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/landings",
        response: { json: [] },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["land", "list"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("land api errors surface message", async () => {
  await withSandbox("jjhub-land-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/landings",
        response: {
          status: 404,
          json: { message: "repository not found" },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["land", "list", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("repository not found");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("land land not found shows friendly message", async () => {
  await withSandbox("jjhub-land-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PUT",
        path: "/api/repos/alice/demo/landings/42/land",
        response: {
          status: 404,
          json: { message: "landing request not found" },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["land", "land", "42", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("landing request #42 was not found");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("land land conflict shows actionable message", async () => {
  await withSandbox("jjhub-land-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PUT",
        path: "/api/repos/alice/demo/landings/42/land",
        response: {
          status: 409,
          json: { message: "landing request is not open" },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["land", "land", "42", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("cannot be landed right now");
      expect(result.stderr).toContain("landing request is not open");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
