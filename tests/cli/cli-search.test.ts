import { expect, test } from "bun:test";
import { createMockServer, expectHeader, runCli, withSandbox, writeConfig } from "./helpers";

const REPO_SEARCH_RESULT = {
  items: [
    {
      id: 1,
      owner: "alice",
      name: "demo",
      full_name: "alice/demo",
      description: "A demo repo",
      is_public: true,
      topics: [],
    },
    {
      id: 2,
      owner: "bob",
      name: "project",
      full_name: "bob/project",
      description: "Another project",
      is_public: false,
      topics: ["rust", "cli"],
    },
  ],
  total_count: 2,
  page: 1,
  limit: 30,
};

const ISSUE_SEARCH_RESULT = {
  items: [
    {
      id: 10,
      repository_id: 1,
      repository_owner: "alice",
      repository_name: "demo",
      number: 5,
      title: "Bug report",
      state: "open",
    },
    {
      id: 11,
      repository_id: 1,
      repository_owner: "alice",
      repository_name: "demo",
      number: 6,
      title: "Feature request",
      state: "closed",
    },
  ],
  total_count: 2,
  page: 1,
  limit: 30,
};

const CODE_SEARCH_RESULT = {
  items: [
    {
      id: 1,
      repository_id: 1,
      repository: "alice/demo",
      path: "src/main.rs",
      text_matches: ["fn main() {"],
    },
    {
      id: 2,
      repository_id: 1,
      repository: "alice/demo",
      path: "src/lib.rs",
      text_matches: ["fn main_helper() {"],
    },
  ],
  total_count: 2,
  page: 1,
  limit: 30,
};

test("search repos with mock server", async () => {
  await withSandbox("jjhub-search-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/search/repositories",
        assert({ query, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expect(query.get("q")).toBe("demo");
          expect(query.get("page")).toBe("1");
          expect(query.get("limit")).toBe("30");
        },
        response: { json: REPO_SEARCH_RESULT },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["search", "repos", "demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("alice/demo");
      expect(result.stdout).toContain("bob/project");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("search repos json output", async () => {
  await withSandbox("jjhub-search-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/search/repositories",
        assert({ query }) {
          expect(query.get("q")).toBe("demo");
          expect(query.get("page")).toBe("1");
          expect(query.get("limit")).toBe("30");
        },
        response: { json: REPO_SEARCH_RESULT },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--json", "search", "repos", "demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.total_count).toBe(2);
      expect(Array.isArray(parsed.items)).toBe(true);
      expect((parsed.items as Array<unknown>)).toHaveLength(2);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("search repos toon output", async () => {
  await withSandbox("jjhub-search-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/search/repositories",
        assert({ query }) {
          expect(query.get("q")).toBe("demo");
          expect(query.get("page")).toBe("1");
          expect(query.get("limit")).toBe("30");
        },
        response: { json: REPO_SEARCH_RESULT },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--toon", "search", "repos", "demo"], {
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

test("search repos empty results", async () => {
  await withSandbox("jjhub-search-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/search/repositories",
        assert({ query }) {
          expect(query.get("q")).toBe("nonexistent-xyz");
          expect(query.get("page")).toBe("1");
          expect(query.get("limit")).toBe("30");
        },
        response: { json: { items: [], total_count: 0, page: 1, limit: 30 } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["search", "repos", "nonexistent-xyz"], {
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

test("search repos rejects empty query at runtime", async () => {
  await withSandbox("jjhub-search-", async (sandbox) => {
    const result = await runCli(["search", "repos", "   "], {
      cwd: sandbox.root,
      env: sandbox.env({ JJHUB_TOKEN: "jjhub_testtoken" }),
    });

    expect(result.exitCode).not.toBe(0);
  });
});

test("search repos with limit flag", async () => {
  await withSandbox("jjhub-search-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/search/repositories",
        assert({ query }) {
          expect(query.get("q")).toBe("demo");
          expect(query.get("page")).toBe("1");
          expect(query.get("limit")).toBe("5");
        },
        response: { json: REPO_SEARCH_RESULT },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["search", "repos", "demo", "--limit", "5"], {
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

test("search issues with mock server", async () => {
  await withSandbox("jjhub-search-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/search/issues",
        assert({ query, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expect(query.get("q")).toBe("bug");
          expect(query.get("page")).toBe("1");
          expect(query.get("limit")).toBe("30");
        },
        response: { json: ISSUE_SEARCH_RESULT },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["search", "issues", "bug"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Bug report");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("search issues json output", async () => {
  await withSandbox("jjhub-search-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/search/issues",
        assert({ query }) {
          expect(query.get("q")).toBe("bug");
          expect(query.get("page")).toBe("1");
          expect(query.get("limit")).toBe("30");
        },
        response: { json: ISSUE_SEARCH_RESULT },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--json", "search", "issues", "bug"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.total_count).toBe(2);
      expect(((parsed.items as Array<Record<string, unknown>>) ?? [])).toHaveLength(2);
      expect((parsed.items as Array<Record<string, unknown>>)[0]?.title).toBe("Bug report");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("search issues empty results", async () => {
  await withSandbox("jjhub-search-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/search/issues",
        assert({ query }) {
          expect(query.get("q")).toBe("nonexistent");
          expect(query.get("page")).toBe("1");
          expect(query.get("limit")).toBe("30");
        },
        response: { json: { items: [], total_count: 0, page: 1, limit: 30 } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["search", "issues", "nonexistent"], {
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

test("search issues rejects empty query", async () => {
  await withSandbox("jjhub-search-", async (sandbox) => {
    const result = await runCli(["search", "issues", ""], {
      cwd: sandbox.root,
      env: sandbox.env({ JJHUB_TOKEN: "jjhub_testtoken" }),
    });

    expect(result.exitCode).not.toBe(0);
  });
});

test("search code with mock server", async () => {
  await withSandbox("jjhub-search-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/search/code",
        assert({ query, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expect(query.get("q")).toBe("fn main");
          expect(query.get("page")).toBe("1");
          expect(query.get("limit")).toBe("30");
        },
        response: { json: CODE_SEARCH_RESULT },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["search", "code", "fn main"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("src/main.rs");
      expect(result.stdout).toContain("alice/demo");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("search code json output", async () => {
  await withSandbox("jjhub-search-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/search/code",
        assert({ query }) {
          expect(query.get("q")).toBe("fn main");
          expect(query.get("page")).toBe("1");
          expect(query.get("limit")).toBe("30");
        },
        response: { json: CODE_SEARCH_RESULT },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--json", "search", "code", "fn main"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.total_count).toBe(2);
      expect(Array.isArray(parsed.items)).toBe(true);
      expect(((parsed.items as Array<Record<string, unknown>>) ?? [])).toHaveLength(2);
      expect((parsed.items as Array<Record<string, unknown>>)[0]?.path).toBe("src/main.rs");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("search code toon output", async () => {
  await withSandbox("jjhub-search-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/search/code",
        assert({ query }) {
          expect(query.get("q")).toBe("fn main");
          expect(query.get("page")).toBe("1");
          expect(query.get("limit")).toBe("30");
        },
        response: { json: CODE_SEARCH_RESULT },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--toon", "search", "code", "fn main"], {
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

test("search code empty results", async () => {
  await withSandbox("jjhub-search-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/search/code",
        assert({ query }) {
          expect(query.get("q")).toBe("nonexistent_fn_xyz");
          expect(query.get("page")).toBe("1");
          expect(query.get("limit")).toBe("30");
        },
        response: { json: { items: [], total_count: 0, page: 1, limit: 30 } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["search", "code", "nonexistent_fn_xyz"], {
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

test("search code rejects empty query", async () => {
  await withSandbox("jjhub-search-", async (sandbox) => {
    const result = await runCli(["search", "code", "   "], {
      cwd: sandbox.root,
      env: sandbox.env({ JJHUB_TOKEN: "jjhub_testtoken" }),
    });

    expect(result.exitCode).not.toBe(0);
  });
});

test("search code requires auth", async () => {
  await withSandbox("jjhub-search-", async (sandbox) => {
    const result = await runCli(["search", "code", "fn main"], {
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
