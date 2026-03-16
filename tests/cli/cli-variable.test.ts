import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const VARIABLE = {
  name: "MY_VAR",
  value: "test",
  created_at: "2026-02-19T00:00:00Z",
  updated_at: "2026-02-19T00:00:00Z",
};

test("variable list with mock server", async () => {
  await withSandbox("jjhub-variable-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/owner/repo/variables",
        response: { json: [VARIABLE] },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["variable", "list", "--repo", "owner/repo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("MY_VAR");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("variable list json output", async () => {
  await withSandbox("jjhub-variable-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/owner/repo/variables",
        response: {
          json: [
            {
              name: "VAR_A",
              value: "val_a",
              created_at: "2026-02-19T00:00:00Z",
              updated_at: "2026-02-19T00:00:00Z",
            },
            {
              name: "VAR_B",
              value: "val_b",
              created_at: "2026-02-19T00:00:00Z",
              updated_at: "2026-02-19T00:00:00Z",
            },
          ],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--json", "variable", "list", "--repo", "owner/repo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]?.name).toBe("VAR_A");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("variable list toon output", async () => {
  await withSandbox("jjhub-variable-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/owner/repo/variables",
        response: {
          json: [
            {
              name: "TOON_VAR",
              value: "toon_val",
              created_at: "2026-02-19T00:00:00Z",
              updated_at: "2026-02-19T00:00:00Z",
            },
          ],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--toon", "variable", "list", "--repo", "owner/repo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("TOON_VAR");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("variable list empty", async () => {
  await withSandbox("jjhub-variable-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/owner/repo/variables",
        response: { json: [] },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["variable", "list", "--repo", "owner/repo"], {
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

test("variable get with mock server", async () => {
  await withSandbox("jjhub-variable-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/owner/repo/variables/MY_VAR",
        response: { json: VARIABLE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["variable", "get", "MY_VAR", "--repo", "owner/repo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("test");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("variable get json output", async () => {
  await withSandbox("jjhub-variable-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/owner/repo/variables/JSON_VAR",
        response: {
          json: {
            name: "JSON_VAR",
            value: "json_val",
            created_at: "2026-02-19T00:00:00Z",
            updated_at: "2026-02-19T00:00:00Z",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["--json", "variable", "get", "JSON_VAR", "--repo", "owner/repo"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.name).toBe("JSON_VAR");
      expect(parsed.value).toBe("json_val");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("variable set with mock server", async () => {
  await withSandbox("jjhub-variable-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PUT",
        path: "/api/repos/owner/repo/variables",
        response: { json: VARIABLE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["variable", "set", "MY_VAR", "--body=test", "--repo", "owner/repo"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("MY_VAR");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("variable set json output", async () => {
  await withSandbox("jjhub-variable-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PUT",
        path: "/api/repos/owner/repo/variables",
        response: {
          json: {
            name: "SET_VAR",
            value: "set_val",
            created_at: "2026-02-19T00:00:00Z",
            updated_at: "2026-02-19T00:00:00Z",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["--json", "variable", "set", "SET_VAR", "--body=set_val", "--repo", "owner/repo"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.name).toBe("SET_VAR");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("variable delete with mock server", async () => {
  await withSandbox("jjhub-variable-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/api/repos/owner/repo/variables/MY_VAR",
        response: { status: 200 },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["variable", "delete", "MY_VAR", "--repo", "owner/repo"], {
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

test("variable delete json output", async () => {
  await withSandbox("jjhub-variable-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/api/repos/owner/repo/variables/SILENT_VAR",
        response: { status: 200 },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["--json", "variable", "delete", "SILENT_VAR", "--repo", "owner/repo"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.status).toBe("deleted");
      expect(parsed.name).toBe("SILENT_VAR");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("variable set with whitespace name gets server error", async () => {
  await withSandbox("jjhub-variable-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PUT",
        path: "/api/repos/owner/repo/variables",
        response: {
          status: 422,
          json: { message: "name is required" },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["variable", "set", "  ", "--body=value", "--repo", "owner/repo"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).not.toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("variable delete with whitespace name fails", async () => {
  await withSandbox("jjhub-variable-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech");

    const result = await runCli(["variable", "delete", "  ", "--repo", "owner/repo"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).not.toBe(0);
  });
});

test("variable get with whitespace name fails", async () => {
  await withSandbox("jjhub-variable-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech");

    const result = await runCli(["variable", "get", "  ", "--repo", "owner/repo"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).not.toBe(0);
  });
});

test("variable requires repo context", async () => {
  await withSandbox("jjhub-variable-", async (sandbox) => {
    const result = await runCli(["variable", "list"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
  });
});

test("variable sends auth header", async () => {
  await withSandbox("jjhub-variable-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/owner/repo/variables",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: { json: [] },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      await runCli(["variable", "list", "--repo", "owner/repo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
