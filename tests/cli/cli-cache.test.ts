import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const CACHE_ROWS = [
  {
    id: 11,
    repository_id: 42,
    workflow_run_id: 77,
    bookmark_name: "main",
    cache_key: "npm",
    cache_version: "lock-a",
    object_key: "workflow-cache/repos/42/one.tgz",
    object_size_bytes: 1024,
    compression: "tar+gzip",
    status: "finalized",
    hit_count: 3,
    last_hit_at: "2026-03-12T10:00:00Z",
    finalized_at: "2026-03-12T09:00:00Z",
    expires_at: "2026-03-19T09:00:00Z",
    created_at: "2026-03-12T09:00:00Z",
    updated_at: "2026-03-12T10:00:00Z",
  },
  {
    id: 12,
    repository_id: 42,
    workflow_run_id: 78,
    bookmark_name: "release",
    cache_key: "cargo",
    cache_version: "lock-b",
    object_key: "workflow-cache/repos/42/two.tgz",
    object_size_bytes: 2048,
    compression: "tar+gzip",
    status: "finalized",
    hit_count: 1,
    last_hit_at: "2026-03-12T11:00:00Z",
    finalized_at: "2026-03-12T09:30:00Z",
    expires_at: "2026-03-19T09:30:00Z",
    created_at: "2026-03-12T09:30:00Z",
    updated_at: "2026-03-12T11:00:00Z",
  },
];

test("cache list forwards repo filters and pagination", async () => {
  await withSandbox("jjhub-cache-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/caches",
        assert({ query, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expect(query.get("page")).toBe("2");
          expect(query.get("per_page")).toBe("10");
          expect(query.get("bookmark")).toBe("main");
          expect(query.get("key")).toBe("npm");
        },
        response: { json: [CACHE_ROWS[0]] },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);

      const result = await runCli(
        [
          "cache",
          "list",
          "--repo",
          "alice/demo",
          "--bookmark",
          "main",
          "--key",
          "npm",
          "--page",
          "2",
          "--limit",
          "10",
        ],
        {
          cwd: sandbox.root,
          env: sandbox.env(),
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("npm");
      expect(result.stdout).toContain("main");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("cache list supports json output", async () => {
  await withSandbox("jjhub-cache-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/caches",
        assert({ query }) {
          expect(query.get("page")).toBe("1");
          expect(query.get("per_page")).toBe("30");
        },
        response: { json: CACHE_ROWS },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);

      const result = await runCli(["--json", "cache", "list", "--repo", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(parsed).toHaveLength(2);
      expect(parsed[0]?.cache_key).toBe("npm");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("cache stats uses the repository stats endpoint", async () => {
  await withSandbox("jjhub-cache-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/caches/stats",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: {
          json: {
            cache_count: 2,
            total_size_bytes: 3072,
            repo_quota_bytes: 2147483648,
            archive_max_bytes: 1073741824,
            ttl_seconds: 604800,
            last_hit_at: "2026-03-12T11:00:00Z",
            max_expires_at: "2026-03-19T09:30:00Z",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);

      const result = await runCli(["cache", "stats", "--repo", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("cache_count");
      expect(result.stdout).toContain("3072");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("cache clear forwards filters and reports deleted bytes", async () => {
  await withSandbox("jjhub-cache-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/api/repos/alice/demo/caches",
        assert({ query, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expect(query.get("bookmark")).toBe("main");
          expect(query.get("key")).toBe("npm");
        },
        response: {
          json: {
            deleted_count: 1,
            deleted_bytes: 1024,
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);

      const result = await runCli(
        ["cache", "clear", "--repo", "alice/demo", "--bookmark", "main", "--key", "npm"],
        {
          cwd: sandbox.root,
          env: sandbox.env(),
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("deleted_count");
      expect(result.stdout).toContain("1024");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
