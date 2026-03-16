import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  expectJsonBody,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const MILESTONE_RESPONSE = {
  id: 1,
  title: "v1.0",
  description: "First release milestone",
  state: "open",
  open_issues: 5,
  closed_issues: 3,
  due_on: "2026-06-01T00:00:00Z",
  created_at: "2026-02-19T00:00:00Z",
  updated_at: "2026-02-19T00:00:00Z",
};

test("issue create with milestone uses API correctly", async () => {
  await withSandbox("jjhub-milestone-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/repos/alice/demo/milestones",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expectJsonBody(bodyText, { title: "v1.0" });
        },
        response: { status: 201, json: MILESTONE_RESPONSE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["api", "/repos/alice/demo/milestones", "--method", "POST", "--json", "--field", "title=v1.0"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("milestone list via api command", async () => {
  await withSandbox("jjhub-milestone-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/repos/alice/demo/milestones",
        response: { json: [MILESTONE_RESPONSE] },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["api", "/repos/alice/demo/milestones", "--method", "GET", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.title).toBe("v1.0");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("milestone view via api command", async () => {
  await withSandbox("jjhub-milestone-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/repos/alice/demo/milestones/1",
        response: { json: MILESTONE_RESPONSE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["api", "/repos/alice/demo/milestones/1", "--method", "GET", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.title).toBe("v1.0");
      expect(parsed.state).toBe("open");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("milestone close via api command", async () => {
  await withSandbox("jjhub-milestone-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PATCH",
        path: "/repos/alice/demo/milestones/1",
        assert({ bodyText }) {
          expectJsonBody(bodyText, { state: "closed" });
        },
        response: { json: { ...MILESTONE_RESPONSE, state: "closed" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["api", "/repos/alice/demo/milestones/1", "--method", "PATCH", "--json", "--field", "state=closed"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.state).toBe("closed");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("milestone delete via api command", async () => {
  await withSandbox("jjhub-milestone-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/repos/alice/demo/milestones/1",
        response: { status: 204, body: null },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["api", "/repos/alice/demo/milestones/1", "--method", "DELETE"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
