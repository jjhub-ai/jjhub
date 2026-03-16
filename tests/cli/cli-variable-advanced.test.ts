import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  expectJsonBody,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

test("variable list returns variables", async () => {
  await withSandbox("jjhub-var-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/variables",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: {
          json: [
            { name: "NODE_ENV", value: "production" },
            { name: "LOG_LEVEL", value: "info" },
          ],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["variable", "list", "--repo", "alice/demo", "--json"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(parsed).toHaveLength(2);
      expect(parsed[0]?.name).toBe("NODE_ENV");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("variable get returns single variable", async () => {
  await withSandbox("jjhub-var-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/variables/NODE_ENV",
        response: { json: { name: "NODE_ENV", value: "production" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["variable", "get", "NODE_ENV", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.name).toBe("NODE_ENV");
      expect(parsed.value).toBe("production");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("variable set sends PUT with name and value", async () => {
  await withSandbox("jjhub-var-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PUT",
        path: "/api/repos/alice/demo/variables",
        assert({ bodyText }) {
          expectJsonBody(bodyText, {
            name: "NODE_ENV",
            value: "staging",
          });
        },
        response: { json: { name: "NODE_ENV", value: "staging" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["variable", "set", "NODE_ENV", "--body", "staging", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("variable delete sends DELETE request", async () => {
  await withSandbox("jjhub-var-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/api/repos/alice/demo/variables/NODE_ENV",
        response: { status: 204, body: null },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["variable", "delete", "NODE_ENV", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.status).toBe("deleted");
      expect(parsed.name).toBe("NODE_ENV");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("variable get api error surfaces message", async () => {
  await withSandbox("jjhub-var-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/variables/MISSING",
        response: { status: 404, json: { message: "variable not found" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["variable", "get", "MISSING", "--repo", "alice/demo"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("not found");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
