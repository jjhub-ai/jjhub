import { expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createMockServer,
  expectHeader,
  expectJsonBody,
  readText,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const testIfUnix = process.platform === "win32" ? test.skip : test;

const REPO_DETAIL = {
  id: 7,
  owner: "alice",
  name: "my-repo",
  full_name: "alice/my-repo",
  description: "A repository",
  is_public: false,
  default_bookmark: "trunk",
  topics: ["jj", "rust"],
  is_archived: false,
  is_fork: false,
  num_stars: 8,
  num_watches: 5,
  num_issues: 3,
  clone_url: "git@jjhub.tech:alice/my-repo.git",
  created_at: "2026-02-19T00:00:00Z",
  updated_at: "2026-02-21T00:00:00Z",
};

function writeExecutableScript(path: string, script: string): void {
  writeFileSync(path, script);
  chmodSync(path, 0o755);
}

function setupFakeCloneBinaries(root: string): { binDir: string; logFile: string } {
  const binDir = join(root, "fake-bin");
  const logFile = join(root, "clone-calls.log");
  mkdirSync(binDir, { recursive: true });

  writeExecutableScript(
    join(binDir, "jj"),
    `#!/bin/sh
echo "jj:$*" >> "$JJHUB_CMD_LOG"
exit "\${JJHUB_FAKE_JJ_EXIT:-0}"
`,
  );
  writeExecutableScript(
    join(binDir, "git"),
    `#!/bin/sh
echo "git:$*" >> "$JJHUB_CMD_LOG"
exit "\${JJHUB_FAKE_GIT_EXIT:-0}"
`,
  );

  return { binDir, logFile };
}

test("repo create posts request and prints success", async () => {
  await withSandbox("jjhub-repo-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/user/repos",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          const parsed = expectJsonBody<Record<string, unknown>>(bodyText, {
            name: "my-new-repo",
            description: "A test repository",
          });
          expect(parsed.private).toBeUndefined();
        },
        response: {
          status: 201,
          json: {
            id: 1,
            owner: "alice",
            name: "my-new-repo",
            full_name: "alice/my-new-repo",
            description: "A test repository",
            is_public: true,
            default_branch: "main",
            clone_url: "git@jjhub.tech:alice/my-new-repo.git",
            created_at: "2026-02-19T00:00:00Z",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["repo", "create", "my-new-repo", "--description", "A test repository"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Created repository");
      expect(result.stdout).toContain("alice/my-new-repo");
      expect(result.stdout).toContain("Clone URL:");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("repo create private posts private flag", async () => {
  await withSandbox("jjhub-repo-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/user/repos",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          const parsed = expectJsonBody<Record<string, unknown>>(bodyText, {
            name: "private-repo",
            private: true,
          });
          expect(parsed.description).toBeUndefined();
        },
        response: {
          status: 201,
          json: {
            id: 2,
            owner: "alice",
            name: "private-repo",
            full_name: "alice/private-repo",
            description: "",
            is_public: false,
            default_branch: "main",
            clone_url: "git@jjhub.tech:alice/private-repo.git",
            created_at: "2026-02-19T00:00:00Z",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["repo", "create", "private-repo", "--private"], {
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

test("repo create json output", async () => {
  await withSandbox("jjhub-repo-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/user/repos",
        assert({ bodyText }) {
          expectJsonBody(bodyText, { name: "json-repo" });
        },
        response: {
          status: 201,
          json: {
            id: 3,
            owner: "alice",
            name: "json-repo",
            full_name: "alice/json-repo",
            description: "",
            is_public: true,
            default_branch: "main",
            clone_url: "git@jjhub.tech:alice/json-repo.git",
            created_at: "2026-02-19T00:00:00Z",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--json", "repo", "create", "json-repo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.name).toBe("json-repo");
      expect(parsed.full_name).toBe("alice/json-repo");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("repo create toon output", async () => {
  await withSandbox("jjhub-repo-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/user/repos",
        assert({ bodyText }) {
          expectJsonBody(bodyText, {
            name: "toon-repo",
            description: "Token output",
          });
        },
        response: {
          status: 201,
          json: {
            id: 4,
            owner: "alice",
            name: "toon-repo",
            full_name: "alice/toon-repo",
            description: "Token output",
            is_public: true,
            default_branch: "main",
            clone_url: "git@jjhub.tech:alice/toon-repo.git",
            created_at: "2026-02-19T00:00:00Z",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["--toon", "repo", "create", "toon-repo", "--description", "Token output"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(
        [
          "id: 4",
          "owner: alice",
          "name: toon-repo",
          "full_name: alice/toon-repo",
          "description: Token output",
          "is_public: true",
          "default_branch: main",
          'clone_url: "git@jjhub.tech:alice/toon-repo.git"',
          'created_at: "2026-02-19T00:00:00Z"',
          "",
        ].join("\n"),
      );
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("repo create api error surfaces message", async () => {
  await withSandbox("jjhub-repo-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/user/repos",
        assert({ bodyText }) {
          expectJsonBody(bodyText, { name: "existing-repo" });
        },
        response: {
          status: 422,
          json: { message: "repository name already exists" },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["repo", "create", "existing-repo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).not.toBe(0);
      expect(
        result.stderr.includes("already exists") || result.stderr.includes("message"),
      ).toBe(true);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("repo clone requires repository argument", async () => {
  await withSandbox("jjhub-repo-", async (sandbox) => {
    const result = await runCli(["repo", "clone"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("required arguments were not provided");
  });
});

test("repo clone accepts repository directory and gitflags shape", async () => {
  await withSandbox("jjhub-repo-", async (sandbox) => {
    const emptyPath = join(sandbox.root, "empty-bin");
    mkdirSync(emptyPath, { recursive: true });

    const result = await runCli(
      ["repo", "clone", "alice/my-repo", "my-dir", "--", "--depth", "1"],
      {
        cwd: sandbox.root,
        env: sandbox.env({ PATH: emptyPath }),
      },
    );

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("unexpected argument")).toBe(false);
  });
});

test("repo clone shorthand looks up repo metadata", async () => {
  await withSandbox("jjhub-repo-", async (sandbox) => {
    const emptyPath = join(sandbox.root, "empty-bin");
    mkdirSync(emptyPath, { recursive: true });
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: {
          json: {
            id: 7,
            owner: "alice",
            name: "demo",
            full_name: "alice/demo",
            description: "",
            is_public: true,
            default_bookmark: "main",
            topics: [],
            is_archived: false,
            is_fork: false,
            num_stars: 0,
            num_watches: 0,
            num_issues: 0,
            clone_url: "git@jjhub.tech:alice/demo.git",
            created_at: "2026-02-19T00:00:00Z",
            updated_at: "2026-02-19T00:00:00Z",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["repo", "clone", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env({ PATH: emptyPath }),
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.includes("unexpected argument")).toBe(false);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("repo clone shorthand surfaces api errors", async () => {
  await withSandbox("jjhub-repo-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/missing",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: {
          status: 404,
          json: { message: "repository not found" },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["repo", "clone", "alice/missing"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("repository not found");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

testIfUnix("repo clone shorthand does not require auth when clone can proceed", async () => {
  await withSandbox("jjhub-repo-", async (sandbox) => {
    const { binDir, logFile } = setupFakeCloneBinaries(sandbox.root);

    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech", "");
    const result = await runCli(["repo", "clone", "alice/demo"], {
      cwd: sandbox.root,
      env: sandbox.env({
        JJHUB_TOKEN: undefined,
        PATH: binDir,
        JJHUB_CMD_LOG: logFile,
        JJHUB_FAKE_GIT_EXIT: "0",
        JJHUB_FAKE_JJ_EXIT: "0",
      }),
    });

    expect(result.exitCode).toBe(0);
    expect(readText(logFile)).toContain("jj:git clone git@ssh.jjhub.tech:alice/demo.git demo");
  });
});

testIfUnix("repo clone uses jj first and preserves arg order", async () => {
  await withSandbox("jjhub-repo-", async (sandbox) => {
    const { binDir, logFile } = setupFakeCloneBinaries(sandbox.root);

    const result = await runCli(
      ["repo", "clone", "https://jjhub.tech/alice/demo.git", "my-dir", "--", "--depth", "1"],
      {
        cwd: sandbox.root,
        env: sandbox.env({
          PATH: binDir,
          JJHUB_CMD_LOG: logFile,
          JJHUB_FAKE_GIT_EXIT: "0",
          JJHUB_FAKE_JJ_EXIT: "0",
        }),
      },
    );

    expect(result.exitCode).toBe(0);
    expect(readText(logFile).trim().split("\n")).toEqual([
      "jj:git clone https://jjhub.tech/alice/demo.git my-dir --depth 1",
    ]);
  });
});

testIfUnix("repo clone preserves string positionals after json flag", async () => {
  await withSandbox("jjhub-repo-", async (sandbox) => {
    const { binDir, logFile } = setupFakeCloneBinaries(sandbox.root);

    const result = await runCli(["repo", "clone", "--json", "demo", "my-dir"], {
      cwd: sandbox.root,
      env: sandbox.env({
        PATH: binDir,
        JJHUB_CMD_LOG: logFile,
        JJHUB_FAKE_GIT_EXIT: "0",
        JJHUB_FAKE_JJ_EXIT: "0",
      }),
    });

    expect(result.exitCode).toBe(0);
    expect(readText(logFile).trim().split("\n")).toEqual([
      "jj:git clone demo my-dir",
    ]);
  });
});

testIfUnix("repo clone falls back to git when jj fails", async () => {
  await withSandbox("jjhub-repo-", async (sandbox) => {
    const { binDir, logFile } = setupFakeCloneBinaries(sandbox.root);

    const result = await runCli(
      ["repo", "clone", "https://jjhub.tech/alice/demo.git", "my-dir", "--", "--depth", "1"],
      {
        cwd: sandbox.root,
        env: sandbox.env({
          PATH: binDir,
          JJHUB_CMD_LOG: logFile,
          JJHUB_FAKE_GIT_EXIT: "0",
          JJHUB_FAKE_JJ_EXIT: "1",
        }),
      },
    );

    expect(result.exitCode).toBe(0);
    expect(readText(logFile).trim().split("\n")).toEqual([
      "jj:git clone https://jjhub.tech/alice/demo.git my-dir --depth 1",
      "git:clone https://jjhub.tech/alice/demo.git my-dir --depth 1",
    ]);
  });
});

testIfUnix("repo clone fails when jj and git fail", async () => {
  await withSandbox("jjhub-repo-", async (sandbox) => {
    const { binDir, logFile } = setupFakeCloneBinaries(sandbox.root);

    const result = await runCli(["repo", "clone", "https://jjhub.tech/alice/demo.git"], {
      cwd: sandbox.root,
      env: sandbox.env({
        PATH: binDir,
        JJHUB_CMD_LOG: logFile,
        JJHUB_FAKE_GIT_EXIT: "2",
        JJHUB_FAKE_JJ_EXIT: "1",
      }),
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("jj") && result.stderr.includes("git")).toBe(true);
  });
});

test("repo list requires auth", async () => {
  await withSandbox("jjhub-repo-", async (sandbox) => {
    const result = await runCli(["repo", "list"], {
      cwd: sandbox.root,
      env: sandbox.env({ JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile }),
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
    expect(
      result.stderr.includes("not authenticated") || result.stderr.includes("auth"),
    ).toBe(true);
  });
});

test("repo list with mock server", async () => {
  await withSandbox("jjhub-repo-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/user/repos",
        assert({ query, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expect(query.get("page")).toBe("1");
          expect(query.get("per_page")).toBe("30");
        },
        response: {
          json: [
            {
              id: 1,
              name: "my-repo",
              description: "A repo",
              is_public: true,
              default_bookmark: "main",
              created_at: "2026-02-19T00:00:00Z",
              updated_at: "2026-02-20T00:00:00Z",
            },
          ],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["repo", "list"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("my-repo");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("repo list json output", async () => {
  await withSandbox("jjhub-repo-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/user/repos",
        assert({ query }) {
          expect(query.get("page")).toBe("1");
          expect(query.get("per_page")).toBe("30");
        },
        response: {
          json: [
            {
              id: 1,
              name: "my-repo",
              description: "A repo",
              is_public: true,
              default_bookmark: "main",
              created_at: "2026-02-19T00:00:00Z",
              updated_at: "2026-02-20T00:00:00Z",
            },
          ],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--json", "repo", "list"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0]?.name).toBe("my-repo");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("repo view requires auth", async () => {
  await withSandbox("jjhub-repo-", async (sandbox) => {
    const result = await runCli(["repo", "view"], {
      cwd: sandbox.root,
      env: sandbox.env({ JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile }),
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
  });
});

test("repo view with mock server", async () => {
  await withSandbox("jjhub-repo-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/my-repo",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: { json: REPO_DETAIL },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["repo", "view", "--repo=alice/my-repo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("alice/my-repo");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("repo view json output", async () => {
  await withSandbox("jjhub-repo-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/my-repo",
        response: {
          json: {
            ...REPO_DETAIL,
            topics: [],
            num_stars: 0,
            num_watches: 0,
            num_issues: 0,
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--json", "repo", "view", "--repo=alice/my-repo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.owner).toBe("alice");
      expect(parsed.name).toBe("my-repo");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
