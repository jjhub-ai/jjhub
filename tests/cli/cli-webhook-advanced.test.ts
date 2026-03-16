import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  expectJsonBody,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const WEBHOOK_RESPONSE = {
  id: 1,
  type: "jjhub",
  config: { url: "https://example.com/hook", content_type: "json" },
  events: ["push"],
  active: true,
  created_at: "2026-02-19T00:00:00Z",
  updated_at: "2026-02-19T00:00:00Z",
};

test("webhook create sends config and events", async () => {
  await withSandbox("jjhub-wh-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/hooks",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expectJsonBody(bodyText, {
            type: "jjhub",
            config: { url: "https://example.com/hook", content_type: "json" },
            events: ["push"],
            active: true,
          });
        },
        response: { status: 201, json: WEBHOOK_RESPONSE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["webhook", "create", "--url", "https://example.com/hook", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.id).toBe(1);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("webhook list returns webhooks", async () => {
  await withSandbox("jjhub-wh-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/hooks",
        response: { json: [WEBHOOK_RESPONSE] },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["webhook", "list", "--repo", "alice/demo", "--json"], {
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

test("webhook view returns hook and deliveries", async () => {
  await withSandbox("jjhub-wh-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/hooks/1",
        response: { json: WEBHOOK_RESPONSE },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/hooks/1/deliveries",
        response: {
          json: [
            { id: "d1", status: "success", delivered_at: "2026-02-19T01:00:00Z" },
          ],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["webhook", "view", "1", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.hook).toBeDefined();
      expect(parsed.deliveries).toBeDefined();
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("webhook delete sends DELETE request", async () => {
  await withSandbox("jjhub-wh-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/api/repos/alice/demo/hooks/1",
        response: { status: 204, body: null },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["webhook", "delete", "1", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.status).toBe("deleted");
      expect(parsed.id).toBe(1);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("webhook create with custom events", async () => {
  await withSandbox("jjhub-wh-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/hooks",
        assert({ bodyText }) {
          expectJsonBody(bodyText, {
            events: ["push", "landing_request"],
          });
        },
        response: {
          status: 201,
          json: { ...WEBHOOK_RESPONSE, events: ["push", "landing_request"] },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        [
          "webhook", "create",
          "--url", "https://example.com/hook",
          "--events", "push",
          "--events", "landing_request",
          "--repo", "alice/demo",
          "--json",
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
