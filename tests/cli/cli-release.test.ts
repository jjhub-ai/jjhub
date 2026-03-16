import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  expectJsonBody,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const RELEASE_RESPONSE = {
  id: 1,
  tag_name: "v1.0.0",
  target_commitish: "main",
  name: "Release v1.0.0",
  body: "First stable release",
  draft: false,
  prerelease: false,
  is_tag: false,
  author: { id: 1, login: "alice" },
  assets: [],
  created_at: "2026-02-19T00:00:00Z",
  updated_at: "2026-02-19T00:00:00Z",
  published_at: "2026-02-19T00:00:00Z",
};

test("release create sends tag and body", async () => {
  await withSandbox("jjhub-release-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/releases",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expectJsonBody(bodyText, {
            tag_name: "v1.0.0",
            body: "First stable release",
          });
        },
        response: { status: 201, json: RELEASE_RESPONSE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["release", "create", "v1.0.0", "--body", "First stable release", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.tag_name).toBe("v1.0.0");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("release create with draft flag", async () => {
  await withSandbox("jjhub-release-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/releases",
        assert({ bodyText }) {
          expectJsonBody(bodyText, {
            tag_name: "v2.0.0-beta",
            draft: true,
          });
        },
        response: {
          status: 201,
          json: { ...RELEASE_RESPONSE, tag_name: "v2.0.0-beta", draft: true },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["release", "create", "v2.0.0-beta", "--draft", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.draft).toBe(true);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("release list returns releases", async () => {
  await withSandbox("jjhub-release-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/releases",
        assert({ query }) {
          expect(query.get("page")).toBe("1");
          expect(query.get("per_page")).toBe("30");
          expect(query.get("exclude_drafts")).toBe("true");
        },
        response: { json: [RELEASE_RESPONSE] },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["release", "list", "--repo", "alice/demo", "--json"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.tag_name).toBe("v1.0.0");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("release view by tag", async () => {
  await withSandbox("jjhub-release-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/releases/tags/v1.0.0",
        response: { json: RELEASE_RESPONSE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["release", "view", "v1.0.0", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.tag_name).toBe("v1.0.0");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("release delete by tag", async () => {
  await withSandbox("jjhub-release-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/api/repos/alice/demo/releases/tags/v1.0.0",
        response: { status: 204, body: null },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["release", "delete", "v1.0.0", "--repo", "alice/demo"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Deleted");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("release delete by numeric ID tries ID first", async () => {
  await withSandbox("jjhub-release-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/api/repos/alice/demo/releases/1",
        response: { status: 204, body: null },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["release", "delete", "1", "--repo", "alice/demo"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
