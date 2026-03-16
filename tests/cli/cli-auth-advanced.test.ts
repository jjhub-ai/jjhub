import { expect, test } from "bun:test";
import {
  createMockServer,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

test("auth status not logged in shows message", async () => {
  await withSandbox("jjhub-auth-adv-", async (sandbox) => {
    const result = await runCli(["auth", "status"], {
      cwd: sandbox.root,
      env: sandbox.env({ JJHUB_TOKEN: undefined }),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Not logged in");
  });
});

test("auth status with config shows logged in", async () => {
  await withSandbox("jjhub-auth-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/user",
        response: { json: { login: "alice" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url, "jjhub_test_status_token");
      const result = await runCli(["auth", "status"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("alice");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("auth token prints the token to stdout", async () => {
  await withSandbox("jjhub-auth-adv-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech", "jjhub_my_token");
    const result = await runCli(["auth", "token"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("jjhub_my_token");
  });
});

test("auth token json output includes source", async () => {
  await withSandbox("jjhub-auth-adv-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech", "jjhub_my_token");
    const result = await runCli(["auth", "token", "--json"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(parsed.token).toBe("jjhub_my_token");
    expect(typeof parsed.source).toBe("string");
  });
});

test("auth logout clears token", async () => {
  await withSandbox("jjhub-auth-adv-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech", "jjhub_logout_token");
    const result = await runCli(["auth", "logout", "--json"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(parsed.status).toBe("logged_out");
  });
});

test("auth status json output", async () => {
  await withSandbox("jjhub-auth-adv-", async (sandbox) => {
    const result = await runCli(["auth", "status", "--json"], {
      cwd: sandbox.root,
      env: sandbox.env({ JJHUB_TOKEN: undefined }),
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(parsed.logged_in).toBe(false);
  });
});
