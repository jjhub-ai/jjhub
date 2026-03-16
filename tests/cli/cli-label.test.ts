import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  expectJsonBody,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const LABEL = {
  id: 1,
  repository_id: 1,
  name: "bug",
  color: "ff0000",
  description: "Something broken",
  created_at: "",
  updated_at: "",
};

const LABEL_LIST = [
  LABEL,
  {
    id: 2,
    repository_id: 1,
    name: "enhancement",
    color: "0075ca",
    description: "New feature",
    created_at: "",
    updated_at: "",
  },
];

test("label list with mock server", async () => {
  await withSandbox("jjhub-label-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/owner/repo/labels",
        response: { json: LABEL_LIST },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["label", "list", "--repo", "owner/repo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("bug");
      expect(result.stdout).toContain("enhancement");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("label list json output", async () => {
  await withSandbox("jjhub-label-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/owner/repo/labels",
        response: { json: LABEL_LIST },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--json", "label", "list", "--repo", "owner/repo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]?.name).toBe("bug");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("label list toon output", async () => {
  await withSandbox("jjhub-label-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/owner/repo/labels",
        response: { json: LABEL_LIST },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--toon", "label", "list", "--repo", "owner/repo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("bug");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("label list empty", async () => {
  await withSandbox("jjhub-label-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/owner/repo/labels",
        response: { json: [] },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["label", "list", "--repo", "owner/repo"], {
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

test("label list toon contains label data", async () => {
  await withSandbox("jjhub-label-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/owner/repo/labels",
        response: { json: LABEL_LIST },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["label", "list", "--repo", "owner/repo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("bug");
      expect(result.stdout).toContain("ff0000");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("label create with mock server", async () => {
  await withSandbox("jjhub-label-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/owner/repo/labels",
        assert({ bodyText }) {
          expectJsonBody(bodyText, { name: "bug", color: "ff0000" });
        },
        response: { json: LABEL },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["label", "create", "bug", "--color", "ff0000", "--repo", "owner/repo"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("bug");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("label create json output", async () => {
  await withSandbox("jjhub-label-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/owner/repo/labels",
        assert({ bodyText }) {
          expectJsonBody(bodyText, { name: "bug", color: "ff0000" });
        },
        response: { json: LABEL },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["--json", "label", "create", "bug", "--color", "ff0000", "--repo", "owner/repo"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.name).toBe("bug");
      expect(parsed.color).toBe("ff0000");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("label create with description", async () => {
  await withSandbox("jjhub-label-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/owner/repo/labels",
        assert({ bodyText }) {
          expectJsonBody(bodyText, {
            name: "bug",
            color: "ff0000",
            description: "Something broken",
          });
        },
        response: { json: LABEL },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        [
          "label",
          "create",
          "bug",
          "--color",
          "ff0000",
          "--description",
          "Something broken",
          "--repo",
          "owner/repo",
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

test("label create default color", async () => {
  await withSandbox("jjhub-label-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/owner/repo/labels",
        assert({ bodyText }) {
          const parsed = expectJsonBody<Record<string, unknown>>(bodyText, {
            name: "feature",
          });
          // Default color is "" (empty string)
          expect(parsed.color).toBe("");
        },
        response: {
          json: {
            id: 1,
            repository_id: 1,
            name: "feature",
            color: "0075ca",
            description: "",
            created_at: "",
            updated_at: "",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["label", "create", "feature", "--repo", "owner/repo"], {
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

test("label delete with mock server", async () => {
  await withSandbox("jjhub-label-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/api/repos/owner/repo/labels/1",
        response: { status: 200 },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["label", "delete", "1", "--repo", "owner/repo"], {
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

test("label delete json output", async () => {
  await withSandbox("jjhub-label-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/api/repos/owner/repo/labels/1",
        response: { status: 200 },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--json", "label", "delete", "1", "--repo", "owner/repo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

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

test("label delete non-numeric id fails", async () => {
  await withSandbox("jjhub-label-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech");
    const result = await runCli(
      ["label", "delete", "nonexistent-label", "--repo", "owner/repo"],
      { cwd: sandbox.root, env: sandbox.env() },
    );

    expect(result.exitCode).not.toBe(0);
  });
});

test("label create sends whitespace name to server", async () => {
  await withSandbox("jjhub-label-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/owner/repo/labels",
        response: {
          status: 422,
          json: { message: "name is required" },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["label", "create", "  ", "--repo", "owner/repo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).not.toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("label requires repo context", async () => {
  await withSandbox("jjhub-label-", async (sandbox) => {
    const result = await runCli(["label", "list"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
  });
});

test("label sends auth header", async () => {
  await withSandbox("jjhub-label-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/owner/repo/labels",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: { json: [] },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      await runCli(["label", "list", "--repo", "owner/repo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
