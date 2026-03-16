import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  expectJsonBody,
  expectQueryContains,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const ISSUE_RESPONSE = {
  id: 10,
  number: 5,
  title: "Bug report",
  body: "Something is broken",
  state: "open",
  author: { id: 1, login: "alice" },
  assignees: [{ id: 2, login: "bob" }],
  milestone_id: null,
  comment_count: 3,
  created_at: "2026-02-19T00:00:00Z",
  updated_at: "2026-02-20T00:00:00Z",
};

const ISSUE_LIST = [
  {
    id: 10,
    number: 5,
    title: "Bug report",
    body: "Something is broken",
    state: "open",
    author: { id: 1, login: "alice" },
    assignees: [],
    milestone_id: null,
    comment_count: 3,
    created_at: "2026-02-19T00:00:00Z",
    updated_at: "2026-02-20T00:00:00Z",
  },
  {
    id: 11,
    number: 6,
    title: "Feature request",
    body: "Add dark mode",
    state: "open",
    author: { id: 2, login: "bob" },
    assignees: [],
    milestone_id: null,
    comment_count: 0,
    created_at: "2026-02-19T00:00:00Z",
    updated_at: "2026-02-19T00:00:00Z",
  },
];

const CLOSED_ISSUE = {
  id: 10,
  number: 5,
  title: "Bug report",
  body: "Something is broken",
  state: "closed",
  author: { id: 1, login: "alice" },
  assignees: [],
  milestone_id: null,
  comment_count: 4,
  created_at: "2026-02-19T00:00:00Z",
  updated_at: "2026-02-21T00:00:00Z",
};

test("issue create with mock server", async () => {
  await withSandbox("jjhub-issue-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/issues",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expectJsonBody(bodyText, {
            title: "Bug report",
            body: "Something is broken",
          });
        },
        response: { status: 201, json: ISSUE_RESPONSE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        [
          "issue",
          "create",
          "-R",
          "alice/demo",
          "--title",
          "Bug report",
          "--body",
          "Something is broken",
        ],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("#5");
      expect(result.stdout).toContain("Bug report");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("issue create with assignees", async () => {
  await withSandbox("jjhub-issue-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/issues",
        assert({ bodyText }) {
          expectJsonBody(bodyText, {
            title: "Assign me",
            body: "",
            assignees: ["bob"],
          });
        },
        response: { status: 201, json: ISSUE_RESPONSE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        [
          "issue",
          "create",
          "-R",
          "alice/demo",
          "--title",
          "Assign me",
          "--assignee",
          "bob",
        ],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("issue create json output", async () => {
  await withSandbox("jjhub-issue-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/issues",
        response: { status: 201, json: ISSUE_RESPONSE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["issue", "create", "-R", "alice/demo", "--title", "Bug report", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.number).toBe(5);
      expect(parsed.title).toBe("Bug report");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("issue create toon output", async () => {
  await withSandbox("jjhub-issue-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/issues",
        response: { status: 201, json: ISSUE_RESPONSE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["issue", "create", "-R", "alice/demo", "--title", "Bug report", "--toon"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(
        [
          "id: 10",
          "number: 5",
          "title: Bug report",
          "body: Something is broken",
          "state: open",
          "author:",
          "  id: 1",
          "  login: alice",
          "assignees[1]{id,login}:",
          "  2,bob",
          "milestone_id: null",
          "comment_count: 3",
          'created_at: "2026-02-19T00:00:00Z"',
          'updated_at: "2026-02-20T00:00:00Z"',
          "",
        ].join("\n"),
      );
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("issue list with mock server", async () => {
  await withSandbox("jjhub-issue-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/issues",
        assert({ query }) {
          expectQueryContains(query, {
            state: "open",
            page: "1",
            per_page: "30",
          });
        },
        response: { json: ISSUE_LIST },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["issue", "list", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Bug report");
      expect(result.stdout).toContain("Feature request");
      expect(result.stdout).toContain("alice");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("issue list closed state", async () => {
  await withSandbox("jjhub-issue-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/issues",
        assert({ query }) {
          expectQueryContains(query, { state: "closed" });
        },
        response: { json: [] },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["issue", "list", "-R", "alice/demo", "--state", "closed"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      expect(
        result.stdout.includes("No issues found") ||
          result.stdout.trim() === "" ||
          result.stdout.includes("0"),
      ).toBe(true);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("issue list json output", async () => {
  await withSandbox("jjhub-issue-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/issues",
        response: { json: ISSUE_LIST },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["issue", "list", "-R", "alice/demo", "--json"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]?.number).toBe(5);
      expect(parsed[1]?.number).toBe(6);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("issue list json single-field filtering keeps requested field", async () => {
  await withSandbox("jjhub-issue-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/issues",
        response: { json: ISSUE_LIST },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["issue", "list", "-R", "alice/demo", "--json", "title"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as string[];
      expect(parsed).toEqual(["Bug report", "Feature request"]);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("issue list all state sends no state param", async () => {
  await withSandbox("jjhub-issue-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/issues",
        assert({ query }) {
          expectQueryContains(query, { page: "1", per_page: "30" });
          expect(query.get("state")).toBeNull();
        },
        response: { json: [] },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["issue", "list", "-R", "alice/demo", "--state", "all"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("issue view with mock server", async () => {
  await withSandbox("jjhub-issue-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/issues/5",
        response: { json: ISSUE_RESPONSE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["issue", "view", "5", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Bug report");
      expect(result.stdout).toContain("#5");
      expect(result.stdout).toContain("alice");
      expect(result.stdout).toContain("open");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("issue view accepts json flag before positional arg", async () => {
  await withSandbox("jjhub-issue-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/issues/5",
        response: { json: ISSUE_RESPONSE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["issue", "view", "--json", "5", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.number).toBe(5);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("issue view accepts json field selection before positional arg", async () => {
  await withSandbox("jjhub-issue-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/issues/5",
        response: { json: ISSUE_RESPONSE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["issue", "view", "--json", "title", "5", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toBe("Bug report");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("issue view json output", async () => {
  await withSandbox("jjhub-issue-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/issues/5",
        response: { json: ISSUE_RESPONSE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["issue", "view", "5", "-R", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.number).toBe(5);
      expect(parsed.title).toBe("Bug report");
      expect(parsed.state).toBe("open");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("issue view not found", async () => {
  await withSandbox("jjhub-issue-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/issues/999",
        response: { status: 404, json: { message: "issue not found" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["issue", "view", "999", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout.trim()).toBe("");
      expect(result.stderr).toContain("issue not found");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("issue close with mock server", async () => {
  await withSandbox("jjhub-issue-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PATCH",
        path: "/api/repos/alice/demo/issues/5",
        assert({ bodyText }) {
          expectJsonBody(bodyText, { state: "closed" });
        },
        response: { json: CLOSED_ISSUE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["issue", "close", "5", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(
        result.stdout.includes("Closed") ||
          result.stdout.includes("closed") ||
          result.stdout.includes("#5"),
      ).toBe(true);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("issue close with comment", async () => {
  await withSandbox("jjhub-issue-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/issues/5/comments",
        assert({ bodyText }) {
          expectJsonBody(bodyText, {
            body: "Duplicate of #3",
          });
        },
        response: {
          status: 201,
          json: { id: 99, body: "Duplicate of #3" },
        },
      },
      {
        method: "PATCH",
        path: "/api/repos/alice/demo/issues/5",
        assert({ bodyText }) {
          expectJsonBody(bodyText, {
            state: "closed",
          });
        },
        response: { json: CLOSED_ISSUE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["issue", "close", "5", "-R", "alice/demo", "--comment", "Duplicate of #3"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("issue close json output", async () => {
  await withSandbox("jjhub-issue-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PATCH",
        path: "/api/repos/alice/demo/issues/5",
        response: { json: CLOSED_ISSUE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["issue", "close", "5", "-R", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.state).toBe("closed");
      expect(parsed.number).toBe(5);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("issue api errors surface message", async () => {
  await withSandbox("jjhub-issue-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/issues",
        response: { status: 404, json: { message: "repository not found" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["issue", "list", "-R", "alice/demo"], {
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
