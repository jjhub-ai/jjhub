import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  expectJsonBody,
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

test("land create sends POST with title and change_ids", async () => {
  await withSandbox("jjhub-land-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/landings",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expectJsonBody(bodyText, {
            title: "Add feature",
            target_bookmark: "main",
            change_ids: ["abc123"],
          });
        },
        response: {
          status: 201,
          json: landing({ number: 10, title: "Add feature", change_ids: ["abc123"] }),
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["land", "create", "--title", "Add feature", "--change-id", "abc123", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.number).toBe(10);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("land list returns landing requests", async () => {
  await withSandbox("jjhub-land-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/landings",
        assert({ query }) {
          expect(query.get("state")).toBe("open");
          expect(query.get("page")).toBe("1");
          expect(query.get("per_page")).toBe("30");
        },
        response: { json: [landing(), landing({ number: 43, title: "Fix bug" })] },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["land", "list", "--repo", "alice/demo", "--json"],
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

test("land view returns details with changes and reviews", async () => {
  await withSandbox("jjhub-land-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/landings/42",
        response: { json: landing() },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/landings/42/changes",
        response: { json: [{ change_id: "k1", description: "My change" }] },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/landings/42/reviews",
        response: { json: [] },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/landings/42/conflicts",
        response: { json: { conflict_status: "clean" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["land", "view", "42", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.landing).toBeDefined();
      expect(parsed.changes).toBeDefined();
      expect(parsed.reviews).toBeDefined();
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("land land merges a landing request", async () => {
  await withSandbox("jjhub-land-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PUT",
        path: "/api/repos/alice/demo/landings/42/land",
        response: { json: landing({ state: "merged" }) },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["land", "land", "42", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.state).toBe("merged");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("land edit patches title", async () => {
  await withSandbox("jjhub-land-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PATCH",
        path: "/api/repos/alice/demo/landings/42",
        assert({ bodyText }) {
          expectJsonBody(bodyText, { title: "Updated title" });
        },
        response: { json: landing({ title: "Updated title" }) },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["land", "edit", "42", "--title", "Updated title", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.title).toBe("Updated title");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("land comment adds comment to landing request", async () => {
  await withSandbox("jjhub-land-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/landings/42/comments",
        assert({ bodyText }) {
          expectJsonBody(bodyText, { body: "Looks good!" });
        },
        response: {
          status: 201,
          json: { id: 1, body: "Looks good!", author: { login: "bob" } },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["land", "comment", "42", "--body", "Looks good!", "--repo", "alice/demo"],
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

test("land review submits approval", async () => {
  await withSandbox("jjhub-land-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/landings/42/reviews",
        assert({ bodyText }) {
          expectJsonBody(bodyText, { type: "approve", body: "" });
        },
        response: {
          status: 201,
          json: { id: 1, type: "approve", body: "" },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["land", "review", "42", "--approve", "--repo", "alice/demo"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("approval");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
