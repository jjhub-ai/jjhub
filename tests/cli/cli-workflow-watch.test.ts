import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const WORKFLOW_RUN_RUNNING = {
  id: 42,
  repository_id: 10,
  workflow_definition_id: 1,
  status: "running",
  trigger_event: "dispatch",
  trigger_ref: "main",
  trigger_commit_sha: "abc123def456",
  started_at: "2026-02-01T10:00:00Z",
  completed_at: null,
  created_at: "2026-02-01T10:00:00Z",
  updated_at: "2026-02-01T10:00:00Z",
};

const WORKFLOW_RUN_COMPLETED = {
  ...WORKFLOW_RUN_RUNNING,
  status: "completed",
  completed_at: "2026-02-01T10:05:00Z",
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

test("workflow watch returns immediately for completed run", async () => {
  await withSandbox("jjhub-workflow-watch-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/runs/42",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: { json: WORKFLOW_RUN_COMPLETED },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--json", "workflow", "watch", "42", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.id).toBe(42);
      expect(parsed.status).toBe("completed");
      expect(result.stderr).toContain("already completed");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workflow watch streams SSE log events to stderr", async () => {
  await withSandbox("jjhub-workflow-watch-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/runs/42",
        response: { json: WORKFLOW_RUN_RUNNING },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/runs/42/logs",
        assert({ request }) {
          expectHeader(request, "accept", "text/event-stream");
        },
        response: () =>
          sseResponse([
            { type: "log", id: "1", data: '{"step":1,"content":"Building...","line":1}' },
            { type: "log", id: "2", data: '{"step":1,"content":"Build complete","line":2}' },
            { type: "done", data: '{"status":"completed"}' },
          ]),
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["workflow", "watch", "42", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      // Log lines go to stderr for clean --json support
      expect(result.stderr).toContain("[step 1] Building...");
      expect(result.stderr).toContain("[step 1] Build complete");
      expect(result.stderr).toContain("Watching run #42");
      expect(result.stderr).toContain("Run completed: completed");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workflow watch json output includes events", async () => {
  await withSandbox("jjhub-workflow-watch-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/runs/42",
        response: { json: WORKFLOW_RUN_RUNNING },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/runs/42/logs",
        response: () =>
          sseResponse([
            { type: "log", id: "1", data: '{"step":1,"content":"hello","line":1}' },
            { type: "done", data: '{"status":"completed"}' },
          ]),
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--json", "workflow", "watch", "42", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.id).toBe(42);
      expect(Array.isArray(parsed.events)).toBe(true);
      const events = parsed.events as Array<{ type: string }>;
      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events.some((e) => e.type === "log")).toBe(true);
      expect(events.some((e) => e.type === "done")).toBe(true);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workflow watch handles SSE status events", async () => {
  await withSandbox("jjhub-workflow-watch-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/runs/42",
        response: { json: WORKFLOW_RUN_RUNNING },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/runs/42/logs",
        response: () =>
          sseResponse([
            { type: "status", data: '{"status":"running","step":1}' },
            { type: "log", id: "1", data: '{"step":1,"content":"test output","line":1}' },
            { type: "done", data: '{"status":"completed"}' },
          ]),
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["workflow", "watch", "42", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("Status: running (step 1)");
      expect(result.stderr).toContain("[step 1] test output");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workflow watch handles 404 for unknown run", async () => {
  await withSandbox("jjhub-workflow-watch-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/runs/9999",
        response: { status: 404, json: { message: "run not found" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["workflow", "watch", "9999", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).not.toBe(0);
      // The server may or may not be hit depending on how incur handles the arg
      // The important thing is the command fails gracefully
    } finally {
      server.stop();
    }
  });
});

test("run watch returns immediately for completed run", async () => {
  await withSandbox("jjhub-run-watch-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/runs/42",
        response: { json: WORKFLOW_RUN_COMPLETED },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--json", "run", "watch", "42", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.id).toBe(42);
      expect(parsed.status).toBe("completed");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("run watch streams log events to stderr", async () => {
  await withSandbox("jjhub-run-watch-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/runs/42",
        response: { json: WORKFLOW_RUN_RUNNING },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/runs/42/logs",
        response: () =>
          sseResponse([
            { type: "log", id: "1", data: '{"step":2,"content":"Deploying...","line":1}' },
            { type: "done", data: '{"status":"completed"}' },
          ]),
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["run", "watch", "42", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("[step 2] Deploying...");
      expect(result.stderr).toContain("Run completed: completed");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workflow watch returns immediately for failed run", async () => {
  await withSandbox("jjhub-workflow-watch-", async (sandbox) => {
    const failedRun = { ...WORKFLOW_RUN_RUNNING, status: "failed" };
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/runs/42",
        response: { json: failedRun },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--json", "workflow", "watch", "42", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.status).toBe("failed");
      expect(result.stderr).toContain("already failed");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workflow watch returns immediately for cancelled run", async () => {
  await withSandbox("jjhub-workflow-watch-", async (sandbox) => {
    const cancelledRun = { ...WORKFLOW_RUN_RUNNING, status: "cancelled" };
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/runs/42",
        response: { json: cancelledRun },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--json", "workflow", "watch", "42", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.status).toBe("cancelled");
      expect(result.stderr).toContain("already cancelled");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
