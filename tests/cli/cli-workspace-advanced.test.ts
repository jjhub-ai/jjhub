import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  expectJsonBody,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const WORKSPACE_RESPONSE = {
  id: "ws_123",
  repository_id: 1,
  user_id: 1,
  name: "primary",
  status: "running",
  is_fork: false,
  freestyle_vm_id: "vm_123",
  persistence: "sticky",
  created_at: "2026-02-19T00:00:00Z",
  updated_at: "2026-02-19T00:00:00Z",
};

test("workspace list returns workspaces", async () => {
  await withSandbox("jjhub-ws-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: {
          json: [WORKSPACE_RESPONSE],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["workspace", "list", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.id).toBe("ws_123");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workspace create sends POST request", async () => {
  await withSandbox("jjhub-ws-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/workspaces",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          const body = JSON.parse(bodyText) as Record<string, unknown>;
          expect(body.name).toBe("feature-ws");
        },
        response: {
          status: 201,
          json: { ...WORKSPACE_RESPONSE, id: "ws_456", name: "feature-ws" },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["workspace", "create", "--name", "feature-ws", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.name).toBe("feature-ws");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workspace delete sends DELETE request", async () => {
  await withSandbox("jjhub-ws-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/api/repos/alice/demo/workspaces/ws_123",
        response: { status: 204, body: null },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["workspace", "delete", "ws_123", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workspace list empty returns empty array", async () => {
  await withSandbox("jjhub-ws-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces",
        response: { json: [] },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["workspace", "list", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(parsed).toHaveLength(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workspace list api error surfaces message", async () => {
  await withSandbox("jjhub-ws-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces",
        response: { status: 404, json: { message: "repository not found" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["workspace", "list", "--repo", "alice/demo"],
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
