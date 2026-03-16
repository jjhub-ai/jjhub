import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const WORKSPACE = {
  id: "ws_abc123",
  repository_id: 1,
  user_id: 1,
  name: "dev-workspace",
  status: "running",
  is_fork: false,
  freestyle_vm_id: "vm_123",
  persistence: "sticky",
  idle_timeout_seconds: 1800,
  created_at: "2026-03-07T00:00:00Z",
  updated_at: "2026-03-07T00:00:00Z",
};

function sseResponse(events: Array<{ type?: string; id?: string; data: string }>): Response {
  const lines: string[] = [];
  for (const event of events) {
    if (event.id) {
      lines.push(`id: ${event.id}`);
    }
    if (event.type) {
      lines.push(`event: ${event.type}`);
    }
    lines.push(`data: ${event.data}`);
    lines.push("");
  }
  return new Response(lines.join("\n"), {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

test("workspace watch connects and streams status events", async () => {
  await withSandbox("jjhub-ws-watch-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_abc123",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: { json: WORKSPACE },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_abc123/stream",
        assert({ request }) {
          expectHeader(request, "accept", "text/event-stream");
        },
        response: () =>
          sseResponse([
            { data: '{"status":"running","action":"started"}' },
            { data: '{"status":"suspended","action":"idle_timeout"}' },
          ]),
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["workspace", "watch", "-R", "alice/demo", "ws_abc123"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("Watching workspace ws_abc123 (dev-workspace)");
      expect(result.stderr).toContain("Status: running");
      expect(result.stderr).toContain("Status: suspended");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workspace watch json output includes events", async () => {
  await withSandbox("jjhub-ws-watch-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_abc123",
        response: { json: WORKSPACE },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_abc123/stream",
        response: () =>
          sseResponse([
            { data: '{"status":"running"}' },
          ]),
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["--json", "workspace", "watch", "-R", "alice/demo", "ws_abc123"],
        {
          cwd: sandbox.root,
          env: sandbox.env(),
        },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.id).toBe("ws_abc123");
      expect(Array.isArray(parsed.events)).toBe(true);
      const events = parsed.events as Array<{ type: string; data: unknown }>;
      expect(events.length).toBeGreaterThanOrEqual(1);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workspace watch handles action events", async () => {
  await withSandbox("jjhub-ws-watch-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_abc123",
        response: { json: WORKSPACE },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_abc123/stream",
        response: () =>
          sseResponse([
            { data: '{"action":"snapshot_created","message":"Snapshot snap_001 saved"}' },
          ]),
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["workspace", "watch", "-R", "alice/demo", "ws_abc123"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("Event: snapshot_created");
      expect(result.stderr).toContain("Snapshot snap_001 saved");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workspace watch exits on deleted status", async () => {
  await withSandbox("jjhub-ws-watch-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_abc123",
        response: { json: WORKSPACE },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_abc123/stream",
        response: () =>
          sseResponse([
            { data: '{"status":"running"}' },
            { data: '{"status":"deleted"}' },
            // This event should NOT be processed since deleted is terminal
            { data: '{"status":"should_not_appear"}' },
          ]),
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["--json", "workspace", "watch", "-R", "alice/demo", "ws_abc123"],
        {
          cwd: sandbox.root,
          env: sandbox.env(),
        },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      const events = parsed.events as Array<{ data: { status?: string } }>;
      // Should have 2 events (running + deleted), not 3
      expect(events).toHaveLength(2);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workspace watch exits on error status", async () => {
  await withSandbox("jjhub-ws-watch-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_abc123",
        response: { json: WORKSPACE },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_abc123/stream",
        response: () =>
          sseResponse([
            { data: '{"status":"error"}' },
          ]),
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["--json", "workspace", "watch", "-R", "alice/demo", "ws_abc123"],
        {
          cwd: sandbox.root,
          env: sandbox.env(),
        },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      const events = parsed.events as Array<{ data: { status?: string } }>;
      expect(events).toHaveLength(1);
      expect((events[0].data as { status: string }).status).toBe("error");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workspace watch handles 404 for unknown workspace", async () => {
  await withSandbox("jjhub-ws-watch-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_nonexistent",
        response: { status: 404, json: { message: "workspace not found" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["workspace", "watch", "-R", "alice/demo", "ws_nonexistent"],
        {
          cwd: sandbox.root,
          env: sandbox.env(),
        },
      );

      expect(result.exitCode).not.toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workspace watch handles SSE stream failure", async () => {
  await withSandbox("jjhub-ws-watch-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_abc123",
        response: { json: WORKSPACE },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_abc123/stream",
        response: { status: 500, json: { message: "internal error" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["workspace", "watch", "-R", "alice/demo", "ws_abc123"],
        {
          cwd: sandbox.root,
          env: sandbox.env(),
        },
      );

      expect(result.exitCode).not.toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workspace watch displays workspace name in header", async () => {
  await withSandbox("jjhub-ws-watch-", async (sandbox) => {
    const wsNoName = { ...WORKSPACE, name: "" };
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_abc123",
        response: { json: wsNoName },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_abc123/stream",
        response: () => sseResponse([]),
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["workspace", "watch", "-R", "alice/demo", "ws_abc123"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      // Without a name, should not include parenthetical
      expect(result.stderr).toContain("Watching workspace ws_abc123");
      expect(result.stderr).not.toContain("()");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
