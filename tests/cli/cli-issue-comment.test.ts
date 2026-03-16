import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  expectJsonBody,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const COMMENT_RESPONSE = {
  id: 99,
  body: "Nice find!",
  author: { id: 1, login: "alice" },
  created_at: "2026-02-19T00:00:00Z",
  updated_at: "2026-02-19T00:00:00Z",
};

const ISSUE_RESPONSE = {
  id: 10,
  number: 5,
  title: "Bug report",
  body: "Something is broken",
  state: "open",
  author: { id: 1, login: "alice" },
  assignees: [],
  milestone_id: null,
  comment_count: 4,
  created_at: "2026-02-19T00:00:00Z",
  updated_at: "2026-02-20T00:00:00Z",
};

test("issue comment create sends POST to comments endpoint", async () => {
  await withSandbox("jjhub-comment-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/issues/5/comments",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expectJsonBody(bodyText, { body: "Nice find!" });
        },
        response: { status: 201, json: COMMENT_RESPONSE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["issue", "comment", "5", "--body", "Nice find!", "-R", "alice/demo"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("comment");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("issue comment create json output", async () => {
  await withSandbox("jjhub-comment-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/issues/5/comments",
        assert({ bodyText }) {
          expectJsonBody(bodyText, { body: "LGTM" });
        },
        response: { status: 201, json: { ...COMMENT_RESPONSE, body: "LGTM" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["issue", "comment", "5", "--body", "LGTM", "-R", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.body).toBe("LGTM");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("issue edit updates title", async () => {
  await withSandbox("jjhub-comment-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PATCH",
        path: "/api/repos/alice/demo/issues/5",
        assert({ bodyText }) {
          expectJsonBody(bodyText, { title: "Updated title" });
        },
        response: { json: { ...ISSUE_RESPONSE, title: "Updated title" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["issue", "edit", "5", "--title", "Updated title", "-R", "alice/demo"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Updated");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("issue edit updates body", async () => {
  await withSandbox("jjhub-comment-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PATCH",
        path: "/api/repos/alice/demo/issues/5",
        assert({ bodyText }) {
          expectJsonBody(bodyText, { body: "New body content" });
        },
        response: { json: { ...ISSUE_RESPONSE, body: "New body content" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["issue", "edit", "5", "--body", "New body content", "-R", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.body).toBe("New body content");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("issue reopen sends state open", async () => {
  await withSandbox("jjhub-comment-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PATCH",
        path: "/api/repos/alice/demo/issues/5",
        assert({ bodyText }) {
          expectJsonBody(bodyText, { state: "open" });
        },
        response: { json: ISSUE_RESPONSE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["issue", "reopen", "5", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Reopened");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
