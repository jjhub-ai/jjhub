import { expect, test } from "bun:test";
import { createMockServer, expectJsonBody, runCli, withSandbox, writeConfig } from "./helpers";

test("webhook create reads secret from stdin", async () => {
  await withSandbox("jjhub-webhook-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/owner/repo/hooks",
        assert({ bodyText }) {
          expectJsonBody(bodyText, {
            type: "jjhub",
            config: {
              url: "https://example.com/webhook",
              content_type: "json",
              secret: "super_secret",
            },
            events: ["push"],
            active: true,
          });
        },
        response: {
          json: {
            id: 1,
            url: "https://example.com/webhook",
            events: ["push"],
            active: true,
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        [
          "webhook",
          "create",
          "--url",
          "https://example.com/webhook",
          "--secret-stdin",
          "-R",
          "owner/repo",
        ],
        { cwd: sandbox.root, env: sandbox.env(), stdin: "super_secret" },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("webhook update reads secret from stdin", async () => {
  await withSandbox("jjhub-webhook-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PATCH",
        path: "/api/repos/owner/repo/hooks/7",
        assert({ bodyText }) {
          expectJsonBody(bodyText, {
            config: {
              secret: "rotated_secret",
            },
          });
        },
        response: {
          json: {
            id: 7,
            url: "https://example.com/webhook",
            events: ["push"],
            active: true,
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["webhook", "update", "7", "--secret-stdin", "-R", "owner/repo"],
        { cwd: sandbox.root, env: sandbox.env(), stdin: "rotated_secret" },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("webhook update rejects insecure secret flag", async () => {
  await withSandbox("jjhub-webhook-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech");

    const result = await runCli(
      ["webhook", "update", "7", "--secret=rotated_secret", "-R", "owner/repo"],
      { cwd: sandbox.root, env: sandbox.env() },
    );

    expect(result.exitCode).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("secret");
  });
});
