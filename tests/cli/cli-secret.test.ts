import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const SECRET = {
  name: "MY_SECRET",
  created_at: "2026-02-19T00:00:00Z",
  updated_at: "2026-02-19T00:00:00Z",
};

test("secret list with mock server", async () => {
  await withSandbox("jjhub-secret-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/owner/repo/secrets",
        response: { json: [SECRET] },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["secret", "list", "--repo", "owner/repo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("MY_SECRET");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("secret list json output", async () => {
  await withSandbox("jjhub-secret-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/owner/repo/secrets",
        response: {
          json: [
            SECRET,
            {
              name: "ANOTHER",
              created_at: "2026-02-19T00:00:00Z",
              updated_at: "2026-02-19T00:00:00Z",
            },
          ],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--json", "secret", "list", "--repo", "owner/repo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]?.name).toBe("MY_SECRET");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("secret list toon output", async () => {
  await withSandbox("jjhub-secret-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/owner/repo/secrets",
        response: {
          json: [
            {
              name: "TOON_SECRET",
              created_at: "2026-02-19T00:00:00Z",
              updated_at: "2026-02-19T00:00:00Z",
            },
          ],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--toon", "secret", "list", "--repo", "owner/repo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("TOON_SECRET");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("secret list empty", async () => {
  await withSandbox("jjhub-secret-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/owner/repo/secrets",
        response: { json: [] },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["secret", "list", "--repo", "owner/repo"], {
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

test("secret set with mock server", async () => {
  await withSandbox("jjhub-secret-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/owner/repo/secrets",
        response: { json: SECRET },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["secret", "set", "MY_SECRET", "--body-stdin", "--repo", "owner/repo"],
        { cwd: sandbox.root, env: sandbox.env(), stdin: "super_secret" },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("MY_SECRET");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("secret set json output", async () => {
  await withSandbox("jjhub-secret-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/owner/repo/secrets",
        response: {
          json: {
            name: "JSON_SECRET",
            created_at: "2026-02-19T00:00:00Z",
            updated_at: "2026-02-19T00:00:00Z",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["--json", "secret", "set", "JSON_SECRET", "--body-stdin", "--repo", "owner/repo"],
        { cwd: sandbox.root, env: sandbox.env(), stdin: "value" },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.name).toBe("JSON_SECRET");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("secret delete with mock server", async () => {
  await withSandbox("jjhub-secret-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/api/repos/owner/repo/secrets/MY_SECRET",
        response: { status: 200 },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["secret", "delete", "MY_SECRET", "--repo", "owner/repo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("deleted");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("secret delete json output", async () => {
  await withSandbox("jjhub-secret-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/api/repos/owner/repo/secrets/SILENT_SECRET",
        response: { status: 200 },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["--json", "secret", "delete", "SILENT_SECRET", "--repo", "owner/repo"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.status).toBe("deleted");
      expect(parsed.name).toBe("SILENT_SECRET");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("secret set requires body-stdin flag", async () => {
  await withSandbox("jjhub-secret-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech");

    const result = await runCli(
      ["secret", "set", "MY_SECRET", "--repo", "owner/repo"],
      { cwd: sandbox.root, env: sandbox.env() },
    );

    expect(result.exitCode).not.toBe(0);
  });
});

test("secret delete sends correct request", async () => {
  await withSandbox("jjhub-secret-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/api/repos/owner/repo/secrets/TO_DELETE",
        response: { status: 200 },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["secret", "delete", "TO_DELETE", "--repo", "owner/repo"], {
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

test("secret requires repo context", async () => {
  await withSandbox("jjhub-secret-", async (sandbox) => {
    const result = await runCli(["secret", "list"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
  });
});

test("secret sends auth header", async () => {
  await withSandbox("jjhub-secret-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/owner/repo/secrets",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: { json: [] },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      await runCli(["secret", "list", "--repo", "owner/repo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
