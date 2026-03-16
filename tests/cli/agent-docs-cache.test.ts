import { expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { refreshDocsCache } from "../src/agent/docs-cache";
import { createMockServer, expectHeader, withSandbox } from "./helpers";

test("refreshDocsCache caches docs and revalidates with conditional headers", async () => {
  await withSandbox("jjhub-agent-docs-", async (sandbox) => {
    const cacheDirectory = join(sandbox.root, "cache");
    mkdirSync(cacheDirectory, { recursive: true });

    const firstServer = createMockServer([
      {
        method: "GET",
        path: "/llms-full.txt",
        response: {
          status: 200,
          headers: {
            etag: '"docs-v1"',
            "last-modified": "Wed, 11 Mar 2026 12:00:00 GMT",
          },
          body: "# JJHub Docs\n\nLocal-first agent docs.\n",
        },
      },
    ]);

    try {
      const fresh = await refreshDocsCache({
        cacheDirectory,
        url: `${firstServer.url}/llms-full.txt`,
      });
      expect(fresh.status.status).toBe("fresh");
      expect(fresh.status.source).toBe("network");
      expect(fresh.text).toContain("Local-first agent docs.");
      firstServer.assertSatisfied();
    } finally {
      firstServer.stop();
    }

    const secondServer = createMockServer([
      {
        method: "GET",
        path: "/llms-full.txt",
        assert({ request }) {
          expectHeader(request, "if-none-match", '"docs-v1"');
          expectHeader(request, "if-modified-since", "Wed, 11 Mar 2026 12:00:00 GMT");
        },
        response: {
          status: 304,
          body: "",
        },
      },
    ]);

    try {
      const cached = await refreshDocsCache({
        cacheDirectory,
        url: `${secondServer.url}/llms-full.txt`,
      });
      expect(cached.status.status).toBe("fresh");
      expect(cached.status.source).toBe("cache");
      expect(cached.text).toContain("Local-first agent docs.");
      secondServer.assertSatisfied();
    } finally {
      secondServer.stop();
    }
  });
});

test("refreshDocsCache falls back to stale cache when refresh fails", async () => {
  await withSandbox("jjhub-agent-docs-", async (sandbox) => {
    const cacheDirectory = join(sandbox.root, "cache");
    mkdirSync(cacheDirectory, { recursive: true });

    const primedServer = createMockServer([
      {
        method: "GET",
        path: "/llms-full.txt",
        response: {
          status: 200,
          headers: {
            etag: '"docs-v1"',
          },
          body: "# JJHub Docs\n\nCached docs body.\n",
        },
      },
    ]);

    try {
      await refreshDocsCache({
        cacheDirectory,
        url: `${primedServer.url}/llms-full.txt`,
      });
      primedServer.assertSatisfied();
    } finally {
      primedServer.stop();
    }

    const stale = await refreshDocsCache({
      cacheDirectory,
      url: "http://127.0.0.1:1/unreachable.txt",
      fetchImpl: async () => {
        throw new Error("offline");
      },
    });

    expect(stale.status.status).toBe("stale");
    expect(stale.status.source).toBe("cache");
    expect(stale.status.warning).toContain("offline");
    expect(stale.text).toContain("Cached docs body.");
  });
});
