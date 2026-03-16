import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  expectJsonBody,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const USER_RESPONSE = {
  id: 1,
  login: "alice",
  email: "alice@example.com",
  is_admin: false,
  active: true,
  created_at: "2026-02-19T00:00:00Z",
};

const USER_LIST = [
  USER_RESPONSE,
  { id: 2, login: "bob", email: "bob@example.com", is_admin: false, active: true, created_at: "2026-02-19T00:00:00Z" },
];

test("admin user list with mock server", async () => {
  await withSandbox("jjhub-admin-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/admin/users",
        assert({ query, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expect(query.get("page")).toBe("1");
          expect(query.get("limit")).toBe("30");
        },
        response: { json: USER_LIST },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["admin", "user", "list"], {
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

test("admin user create sends username and email", async () => {
  await withSandbox("jjhub-admin-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/admin/users",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expectJsonBody(bodyText, {
            username: "charlie",
            email: "charlie@example.com",
            must_change_password: true,
          });
        },
        response: {
          status: 201,
          json: { id: 3, login: "charlie", email: "charlie@example.com", active: true },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["admin", "user", "create", "--username", "charlie", "--email", "charlie@example.com"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("admin user disable patches active to false", async () => {
  await withSandbox("jjhub-admin-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PATCH",
        path: "/api/admin/users/bob",
        assert({ bodyText }) {
          expectJsonBody(bodyText, { active: false });
        },
        response: { json: { ...USER_RESPONSE, login: "bob", active: false } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["admin", "user", "disable", "bob"], {
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

test("admin user delete sends DELETE request", async () => {
  await withSandbox("jjhub-admin-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/api/admin/users/bob",
        response: { status: 204, body: null },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["admin", "user", "delete", "bob", "--json"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.status).toBe("deleted");
      expect(parsed.username).toBe("bob");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("admin runner list with mock server", async () => {
  await withSandbox("jjhub-admin-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/admin/runners",
        response: {
          json: [
            { id: 1, name: "runner-1", status: "online" },
            { id: 2, name: "runner-2", status: "offline" },
          ],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["admin", "runner", "list", "--json"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("admin health returns system health", async () => {
  await withSandbox("jjhub-admin-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/admin/system/health",
        response: {
          json: { status: "healthy", database: "ok", queue: "ok" },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["admin", "health", "--json"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.status).toBe("healthy");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
