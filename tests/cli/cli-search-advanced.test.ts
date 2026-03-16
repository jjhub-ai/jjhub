import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

test("search users returns user results", async () => {
  await withSandbox("jjhub-search-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/search/users",
        assert({ query, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expect(query.get("q")).toBe("alice");
          expect(query.get("page")).toBe("1");
          expect(query.get("limit")).toBe("30");
        },
        response: {
          json: {
            total_count: 1,
            data: [{ id: 1, login: "alice", full_name: "Alice" }],
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["search", "users", "alice", "--json"], {
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

test("search repos returns repository results", async () => {
  await withSandbox("jjhub-search-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/search/repositories",
        assert({ query }) {
          expect(query.get("q")).toBe("jjhub");
        },
        response: {
          json: {
            total_count: 2,
            data: [
              { id: 1, full_name: "alice/jjhub", description: "Main repo" },
              { id: 2, full_name: "bob/jjhub-cli", description: "CLI tool" },
            ],
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["search", "repos", "jjhub", "--json"], {
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

test("search code returns code results", async () => {
  await withSandbox("jjhub-search-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/search/code",
        assert({ query }) {
          expect(query.get("q")).toBe("function main");
        },
        response: {
          json: {
            total_count: 1,
            data: [
              {
                repository: { full_name: "alice/demo" },
                filename: "main.ts",
                content: "function main() {}",
              },
            ],
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["search", "code", "function main", "--json"], {
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

test("search issues returns issue results", async () => {
  await withSandbox("jjhub-search-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/search/issues",
        assert({ query }) {
          expect(query.get("q")).toBe("bug");
          expect(query.get("page")).toBe("1");
          expect(query.get("limit")).toBe("30");
        },
        response: {
          json: {
            total_count: 1,
            data: [
              { id: 10, number: 5, title: "Bug report", state: "open" },
            ],
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["search", "issues", "bug", "--json"], {
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

test("search repos requires query argument", async () => {
  await withSandbox("jjhub-search-adv-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech");
    const result = await runCli(["search", "repos"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).not.toBe(0);
  });
});
