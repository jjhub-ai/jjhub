import { expect, test } from "bun:test";
import { createMockServer, runCli, withSandbox, writeConfig } from "./helpers";

test("api command returns parsed json for successful responses", async () => {
  await withSandbox("jjhub-api-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/healthz",
        response: { json: { status: "ok" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url);
      const result = await runCli(["api", "--format", "json", "/healthz"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({ status: "ok" });
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("api command exits non-zero on http errors", async () => {
  await withSandbox("jjhub-api-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/missing",
        response: { status: 404, json: { message: "missing endpoint" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url);
      const result = await runCli(["api", "/missing"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain("missing endpoint");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
