import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  expectJsonBody,
  expectQueryContains,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const NOTIFICATION_LIST = [
  {
    id: "n1",
    subject: { type: "issue", title: "Bug report" },
    repository: { full_name: "alice/demo" },
    unread: true,
    updated_at: "2026-02-19T00:00:00Z",
  },
  {
    id: "n2",
    subject: { type: "landing_request", title: "Add feature" },
    repository: { full_name: "alice/demo" },
    unread: false,
    updated_at: "2026-02-20T00:00:00Z",
  },
];

test("notification list with mock server", async () => {
  await withSandbox("jjhub-notif-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/notifications/list",
        assert({ query, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expect(query.get("page")).toBe("1");
          expect(query.get("limit")).toBe("30");
        },
        response: { json: NOTIFICATION_LIST },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["notification", "list", "--json"], {
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

test("notification list with unread filter", async () => {
  await withSandbox("jjhub-notif-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/notifications/list",
        assert({ query }) {
          expect(query.get("status")).toBe("unread");
        },
        response: { json: [NOTIFICATION_LIST[0]] },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["notification", "list", "--unread", "--json"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(parsed).toHaveLength(1);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("notification read by ID marks single notification", async () => {
  await withSandbox("jjhub-notif-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PATCH",
        path: "/api/notifications/n1",
        assert({ bodyText }) {
          expectJsonBody(bodyText, { read: true });
        },
        response: { json: { id: "n1", read: true } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["notification", "read", "n1", "--json"], {
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

test("notification read --all marks all as read", async () => {
  await withSandbox("jjhub-notif-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PUT",
        path: "/api/notifications/mark-read",
        response: { json: {} },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["notification", "read", "--all", "--json"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.status).toBe("all_read");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("notification read without id or --all fails", async () => {
  await withSandbox("jjhub-notif-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech");
    const result = await runCli(["notification", "read"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Provide a notification ID");
  });
});
