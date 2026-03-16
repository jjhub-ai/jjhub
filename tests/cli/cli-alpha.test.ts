import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

test("beta waitlist list uses the admin alpha path", async () => {
  await withSandbox("jjhub-alpha-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/admin/alpha/waitlist",
        assert({ query, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expect(query.get("status")).toBe("pending");
          expect(query.get("page")).toBe("2");
          expect(query.get("per_page")).toBe("25");
        },
        response: { json: { entries: [] } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url);
      const result = await runCli(
        ["beta", "waitlist", "list", "--status", "pending", "--page", "2", "--per-page", "25"],
        {
          cwd: sandbox.root,
          env: sandbox.env(),
        },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("beta waitlist approve posts to the admin alpha approve endpoint", async () => {
  await withSandbox("jjhub-alpha-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/admin/alpha/waitlist/approve",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expect(JSON.parse(bodyText)).toEqual({ email: "invitee@example.com" });
        },
        response: { json: { email: "invitee@example.com", status: "approved" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url);
      const result = await runCli(
        ["beta", "waitlist", "approve", "--email", "invitee@example.com"],
        {
          cwd: sandbox.root,
          env: sandbox.env(),
        },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("beta whitelist commands use the admin alpha whitelist paths", async () => {
  await withSandbox("jjhub-alpha-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/admin/alpha/whitelist",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expect(JSON.parse(bodyText)).toEqual({
            identity_type: "email",
            identity_value: "alpha@example.com",
          });
        },
        response: {
          status: 201,
          json: { identity_type: "email", identity_value: "alpha@example.com" },
        },
      },
      {
        method: "GET",
        path: "/api/admin/alpha/whitelist",
        response: { json: [] },
      },
      {
        method: "DELETE",
        path: "/api/admin/alpha/whitelist/email/alpha%40example.com",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: { status: 204 },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url);

      const addResult = await runCli(
        ["beta", "whitelist", "add", "--type", "email", "--value", "alpha@example.com"],
        {
          cwd: sandbox.root,
          env: sandbox.env(),
        },
      );
      expect(addResult.exitCode).toBe(0);

      const listResult = await runCli(["beta", "whitelist", "list"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });
      expect(listResult.exitCode).toBe(0);

      const removeResult = await runCli(
        ["beta", "whitelist", "remove", "--type", "email", "--value", "alpha@example.com"],
        {
          cwd: sandbox.root,
          env: sandbox.env(),
        },
      );
      expect(removeResult.exitCode).toBe(0);

      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
