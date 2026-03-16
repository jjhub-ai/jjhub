import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  expectJsonBody,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const SESSION_RESPONSE = {
  id: "sess_abc123",
  status: "active",
  title: "Fix the bug",
  created_at: "2026-02-19T00:00:00Z",
  updated_at: "2026-02-19T00:00:00Z",
};

test("agent session run creates session and sends message", async () => {
  await withSandbox("jjhub-agent-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/agent/sessions",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          const body = JSON.parse(bodyText) as Record<string, unknown>;
          expect(typeof body.title).toBe("string");
        },
        response: { status: 201, json: SESSION_RESPONSE },
      },
      {
        method: "POST",
        path: "/api/repos/alice/demo/agent/sessions/sess_abc123/messages",
        assert({ bodyText }) {
          const body = JSON.parse(bodyText) as Record<string, unknown>;
          expect(body.role).toBe("user");
          expect(Array.isArray(body.parts)).toBe(true);
        },
        response: { status: 201, json: { id: "msg_1" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["agent", "run", "Fix the bug", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.id).toBe("sess_abc123");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("agent session list returns sessions", async () => {
  await withSandbox("jjhub-agent-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/agent/sessions",
        assert({ query, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expect(query.get("page")).toBe("1");
          expect(query.get("per_page")).toBe("30");
        },
        response: {
          json: [SESSION_RESPONSE, { ...SESSION_RESPONSE, id: "sess_def456", status: "completed" }],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["agent", "session", "list", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(parsed).toHaveLength(2);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("agent session view returns session details", async () => {
  await withSandbox("jjhub-agent-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/agent/sessions/sess_abc123",
        response: { json: SESSION_RESPONSE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["agent", "session", "view", "sess_abc123", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.id).toBe("sess_abc123");
      expect(parsed.status).toBe("active");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("agent session chat sends message to existing session", async () => {
  await withSandbox("jjhub-agent-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/agent/sessions/sess_abc123/messages",
        assert({ bodyText }) {
          const body = JSON.parse(bodyText) as Record<string, unknown>;
          expect(body.role).toBe("user");
          const parts = body.parts as Array<Record<string, unknown>>;
          expect(parts[0]?.content).toBe("What about the tests?");
        },
        response: { status: 201, json: { id: "msg_2" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["agent", "session", "chat", "sess_abc123", "What about the tests?", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("agent session view 404 returns error", async () => {
  await withSandbox("jjhub-agent-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/agent/sessions/nonexistent",
        response: { status: 404, json: { message: "session not found" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["agent", "session", "view", "nonexistent", "--repo", "alice/demo"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("not found");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
