import { expect, test } from "bun:test";
import { createMockServer, expectJsonBody, runCli, withSandbox, writeConfig } from "./helpers";

test("secret set reads value from stdin", async () => {
  await withSandbox("jjhub-secret-stdin-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/owner/repo/secrets",
        assert({ bodyText }) {
          expectJsonBody(bodyText, {
            name: "MY_SECRET",
            value: "super_secret",
          });
        },
        response: {
          json: {
            name: "MY_SECRET",
            created_at: "2026-02-19T00:00:00Z",
            updated_at: "2026-02-19T00:00:00Z",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["secret", "set", "MY_SECRET", "--body-stdin", "-R", "owner/repo"],
        { cwd: sandbox.root, env: sandbox.env(), stdin: "super_secret" },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("secret set rejects insecure body flag", async () => {
  await withSandbox("jjhub-secret-stdin-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech");

    const result = await runCli(
      ["secret", "set", "MY_SECRET", "--body=value", "-R", "owner/repo"],
      { cwd: sandbox.root, env: sandbox.env() },
    );

    expect(result.exitCode).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("body");
  });
});
