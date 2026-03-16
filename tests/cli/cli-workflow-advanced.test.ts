import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const WORKFLOW_RUN = {
  id: 42,
  repository_id: 1,
  workflow_definition_id: 1,
  workflow_name: "ci",
  status: "running",
  trigger_event: "push",
  trigger_ref: "main",
  created_at: "2026-02-19T00:00:00Z",
  updated_at: "2026-02-19T00:00:00Z",
};

const WORKFLOW_RUNS = [
  WORKFLOW_RUN,
  { ...WORKFLOW_RUN, id: 43, status: "success" },
  { ...WORKFLOW_RUN, id: 44, status: "failure" },
];

test("run list returns workflow runs", async () => {
  await withSandbox("jjhub-wf-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/runs",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: { json: WORKFLOW_RUNS },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["run", "list", "--repo", "alice/demo", "--json"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(3);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("run list json output includes all runs", async () => {
  await withSandbox("jjhub-wf-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/runs",
        response: { json: WORKFLOW_RUNS },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["run", "list", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(parsed).toHaveLength(3);
      expect(parsed[1]?.status).toBe("success");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("run view returns run inspection", async () => {
  await withSandbox("jjhub-wf-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/runs/42",
        response: {
          json: {
            run: WORKFLOW_RUN,
            workflow: { id: 1, name: "ci", path: ".jjhub/workflows/ci.ts" },
            nodes: [
              { id: "1", name: "build", position: 0, status: "success" },
              { id: "2", name: "test", position: 1, status: "running" },
            ],
            mermaid: "graph TD",
            plan_xml: '<?xml version="1.0"?>',
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["run", "view", "42", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.run).toBeDefined();
      expect(parsed.nodes).toBeDefined();
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("run cancel sends POST cancel request", async () => {
  await withSandbox("jjhub-wf-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/runs/42/cancel",
        response: { json: { status: "cancelled" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["run", "cancel", "42", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("run rerun sends POST rerun request", async () => {
  await withSandbox("jjhub-wf-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/runs/42/rerun",
        response: { json: { status: "queued" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["run", "rerun", "42", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
