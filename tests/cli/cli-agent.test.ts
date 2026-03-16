import { expect, test } from "bun:test";
import { realpathSync } from "node:fs";
import {
  createMockServer,
  DEFAULT_TEST_TOKEN,
  expectQueryContains,
  initJjRepo,
  runCli,
  runJj,
  withSandbox,
  writeConfig,
} from "./helpers";

test("agent one-shot summary auto-detects repo context", async () => {
  await withSandbox("jjhub-agent-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    const remote = await runJj(
      ["git", "remote", "add", "origin", "git@ssh.jjhub.tech:alice/demo.git"],
      { cwd: sandbox.root },
    );
    expect(remote.exitCode).toBe(0);

    const result = await runCli(["agent", "--format", "json", "how do I log in?"], {
      cwd: sandbox.root,
      env: sandbox.env({
        JJHUB_AGENT_TEST_MODE: "summary",
      }),
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      backend: string;
      repo_context: { repoSlug: string | null; repoRoot: string | null };
      response: string;
    };
    expect(parsed.backend).toBe("local");
    expect(parsed.repo_context.repoSlug).toBe("alice/demo");
    expect(parsed.repo_context.repoRoot).toBe(realpathSync(sandbox.root));
    expect(parsed.response).toBe("how do I log in?");
  });
});

test("bare jjhub defaults to the local helper", async () => {
  await withSandbox("jjhub-agent-", async (sandbox) => {
    await initJjRepo(sandbox.root);

    const result = await runCli(["--format", "json"], {
      cwd: sandbox.root,
      env: sandbox.env({
        JJHUB_AGENT_TEST_MODE: "summary",
      }),
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      backend: string;
      repo_context: { repoRoot: string | null };
    };
    expect(parsed.backend).toBe("local");
    expect(parsed.repo_context.repoRoot).toBe(realpathSync(sandbox.root));
  });
});

test("agent sandbox summary uses workspace backend", async () => {
  await withSandbox("jjhub-agent-", async (sandbox) => {
    await initJjRepo(sandbox.root);

    const server = createMockServer([
      {
        method: "GET",
        path: "/api/user",
        response: { json: { login: "alice" } },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo",
        response: { json: { full_name: "alice/demo" } },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces",
        assert({ request }) {
          expect(request.headers.get("authorization")).toMatch(/^token /);
        },
        response: {
          json: [{ id: "ws_123", status: "running" }],
        },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_123/ssh",
        assert({ request }) {
          expect(request.headers.get("authorization")).toMatch(/^token /);
        },
        response: {
          json: {
            command: "ssh vm_123+root:ssh-token@vm-ssh.jjhub.tech",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url, DEFAULT_TEST_TOKEN);
      const result = await runCli(
        ["agent", "--format", "json", "--repo", "alice/demo", "--sandbox", "check repo auth"],
        {
          cwd: sandbox.root,
          env: sandbox.env({
            JJHUB_AGENT_TEST_MODE: "summary",
            JJHUB_TOKEN: "",
          }),
        },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as {
        backend: string;
        repo_context: { backend?: { backend?: string; workspaceId?: string } };
      };
      expect(parsed.backend).toBe("workspace");
      expect(parsed.repo_context.backend?.backend).toBe("workspace");
      expect(parsed.repo_context.backend?.workspaceId).toBe("ws_123");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("agent session list uses remote session API", async () => {
  await withSandbox("jjhub-agent-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/agent/sessions",
        times: 2,
        assert({ query, request }) {
          expect(request.headers.get("authorization")).toMatch(/^token /);
          expectQueryContains(query, {
            page: "1",
            per_page: "30",
          });
        },
        response: {
          json: [{ id: "sess_123", status: "running" }],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url, DEFAULT_TEST_TOKEN);

      const nested = await runCli(
        ["--json", "agent", "session", "list", "--repo", "alice/demo"],
        { cwd: sandbox.root, env: sandbox.env({ JJHUB_TOKEN: "" }) },
      );
      expect(nested.exitCode).toBe(0);
      const nestedParsed = JSON.parse(nested.stdout) as Array<{ id: string }>;
      expect(nestedParsed[0]?.id).toBe("sess_123");

      const alias = await runCli(
        ["--json", "agent", "list", "--repo", "alice/demo"],
        { cwd: sandbox.root, env: sandbox.env({ JJHUB_TOKEN: "" }) },
      );
      expect(alias.exitCode).toBe(0);
      const aliasParsed = JSON.parse(alias.stdout) as Array<{ id: string }>;
      expect(aliasParsed[0]?.id).toBe("sess_123");

      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("agent errors clearly when jj is missing", async () => {
  await withSandbox("jjhub-agent-", async (sandbox) => {
    const result = await runCli(["agent", "status?"], {
      cwd: sandbox.root,
      env: sandbox.env({
        JJHUB_AGENT_TEST_MODE: "summary",
        PATH: "/nonexistent",
      }),
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("jj (Jujutsu) is not installed");
  });
});
