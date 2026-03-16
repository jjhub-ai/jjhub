import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  expectJsonBody,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const WORKFLOWS = [
  {
    id: 1,
    repository_id: 10,
    name: "CI",
    path: ".jjhub/workflows/ci.tsx",
    is_active: true,
    created_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
  },
  {
    id: 2,
    repository_id: 10,
    name: "Deploy",
    path: ".jjhub/workflows/deploy.tsx",
    is_active: false,
    created_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
  },
];

const RUNS = [
  {
    id: 42,
    repository_id: 10,
    workflow_definition_id: 1,
    workflow_name: "CI",
    workflow_path: ".jjhub/workflows/ci.tsx",
    status: "completed",
    trigger_event: "dispatch",
    trigger_ref: "main",
    trigger_commit_sha: "abc123",
    started_at: "2026-02-01T10:00:00Z",
    completed_at: "2026-02-01T10:05:00Z",
    created_at: "2026-02-01T10:00:00Z",
    updated_at: "2026-02-01T10:05:00Z",
  },
  {
    id: 43,
    repository_id: 10,
    workflow_definition_id: 2,
    workflow_name: "Deploy",
    workflow_path: ".jjhub/workflows/deploy.tsx",
    status: "running",
    trigger_event: "dispatch",
    trigger_ref: "release",
    trigger_commit_sha: "def456",
    started_at: "2026-02-01T11:00:00Z",
    completed_at: null,
    created_at: "2026-02-01T11:00:00Z",
    updated_at: "2026-02-01T11:00:00Z",
  },
];

const RUN_INSPECTION = {
  run: RUNS[0],
  workflow: {
    id: 1,
    name: "CI",
    path: ".jjhub/workflows/ci.tsx",
  },
  nodes: [
    {
      id: "101",
      step_id: 101,
      name: "research",
      position: 1,
      status: "success",
      iteration: 1,
      duration: "47s",
      duration_seconds: 47,
      started_at: "2026-02-01T10:00:00Z",
      completed_at: "2026-02-01T10:00:47Z",
    },
    {
      id: "102",
      step_id: 102,
      name: "implement",
      position: 2,
      status: "running",
      iteration: 1,
      duration: "12s",
      duration_seconds: 12,
      started_at: "2026-02-01T10:00:48Z",
      completed_at: null,
    },
  ],
  mermaid: "graph TD\n    N1[\"research\"]\n    N2[\"implement\"]\n    N1 -->|success 47s| N2",
  plan_xml:
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<workflow name=\"CI\" path=\".jjhub/workflows/ci.tsx\" run_id=\"42\" status=\"completed\">\n  <node id=\"101\" step_id=\"101\" name=\"research\" position=\"1\" status=\"success\" iteration=\"1\" duration=\"47s\"/>\n  <node id=\"102\" step_id=\"102\" name=\"implement\" position=\"2\" status=\"running\" iteration=\"1\" duration=\"12s\"/>\n</workflow>",
};

test("workflow list with mock server", async () => {
  await withSandbox("jjhub-workflow-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/workflows",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: { json: { workflows: WORKFLOWS } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["workflow", "list", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("CI");
      expect(result.stdout).toContain("Deploy");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workflow dispatch sends ref to dispatches endpoint", async () => {
  await withSandbox("jjhub-workflow-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/workflows/1/dispatches",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expectJsonBody(bodyText, {
            ref: "main",
          });
        },
        response: { status: 204 },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        [
          "workflow",
          "dispatch",
          "1",
          "-R",
          "alice/demo",
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

test("workflow dispatch with custom ref", async () => {
  await withSandbox("jjhub-workflow-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/workflows/1/dispatches",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expectJsonBody(bodyText, { ref: "develop" });
        },
        response: { status: 204 },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["workflow", "dispatch", "1", "--ref", "develop", "-R", "alice/demo"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("run list returns runs", async () => {
  await withSandbox("jjhub-workflow-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/runs",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: { json: RUNS },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["run", "list", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("42");
      expect(result.stdout).toContain("Deploy");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("run list --json returns json", async () => {
  await withSandbox("jjhub-workflow-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/runs",
        response: { json: RUNS },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--json", "run", "list", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(parsed).toHaveLength(2);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("run view returns inspection payload", async () => {
  await withSandbox("jjhub-workflow-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/runs/42",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: { json: RUN_INSPECTION },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--json", "run", "view", "42", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect((parsed.run as Record<string, unknown>).id).toBe(42);
      expect(Array.isArray(parsed.nodes)).toBe(true);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("run view toon output contains run info", async () => {
  await withSandbox("jjhub-workflow-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/runs/42",
        response: { json: RUN_INSPECTION },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["run", "view", "42", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("research");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("run watch streams workflow events", async () => {
  await withSandbox("jjhub-workflow-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/runs/42",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: {
          json: {
            id: 42,
            status: "completed",
            workflow_definition_id: 1,
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["run", "watch", "42", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      // For terminal states (completed/failed/cancelled), watch returns immediately
      // with the run data and writes status to stderr
      expect(result.stderr).toContain("already completed");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("run rerun sends POST to rerun endpoint", async () => {
  await withSandbox("jjhub-workflow-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/runs/123/rerun",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: {
          status: 201,
          json: {
            workflow_definition_id: 7,
            workflow_run_id: 456,
            steps: [{ step_id: 1, task_id: 10 }],
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["run", "rerun", "123", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("456");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("run cancel sends POST to cancel endpoint", async () => {
  await withSandbox("jjhub-workflow-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/runs/55/cancel",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: { json: { status: "cancelled" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["run", "cancel", "55", "-R", "alice/demo"], {
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

test("run cancel surfaces API errors", async () => {
  await withSandbox("jjhub-workflow-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/runs/55/cancel",
        response: { status: 409, json: { message: "run is not in a cancellable state" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["run", "cancel", "55", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain("not in a cancellable state");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
