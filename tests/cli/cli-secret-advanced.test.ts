import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  expectJsonBody,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

test("secret list returns secrets", async () => {
  await withSandbox("jjhub-secret-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/secrets",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: {
          json: [
            { name: "API_KEY", created_at: "2026-02-19T00:00:00Z" },
            { name: "DEPLOY_TOKEN", created_at: "2026-02-20T00:00:00Z" },
          ],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["secret", "list", "--repo", "alice/demo", "--json"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(parsed).toHaveLength(2);
      expect(parsed[0]?.name).toBe("API_KEY");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("secret set requires --body-stdin", async () => {
  await withSandbox("jjhub-secret-adv-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech");
    const result = await runCli(
      ["secret", "set", "MY_SECRET", "--repo", "alice/demo"],
      { cwd: sandbox.root, env: sandbox.env() },
    );

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("stdin");
  });
});

test("secret set with --body-stdin sends POST", async () => {
  await withSandbox("jjhub-secret-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/secrets",
        assert({ bodyText }) {
          expectJsonBody(bodyText, {
            name: "MY_SECRET",
            value: "super-secret-value",
          });
        },
        response: { status: 201, json: { name: "MY_SECRET" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["secret", "set", "MY_SECRET", "--body-stdin", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env(), stdin: "super-secret-value" },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("secret delete sends DELETE request", async () => {
  await withSandbox("jjhub-secret-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/api/repos/alice/demo/secrets/API_KEY",
        response: { status: 204, body: null },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["secret", "delete", "API_KEY", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.status).toBe("deleted");
      expect(parsed.name).toBe("API_KEY");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("secret list api error surfaces message", async () => {
  await withSandbox("jjhub-secret-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/secrets",
        response: { status: 403, json: { message: "forbidden" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["secret", "list", "--repo", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("forbidden");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
