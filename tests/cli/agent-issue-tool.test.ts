import { expect, test } from "bun:test";
import { createJjhubIssueTool, resolveIssueTargetRepo } from "../src/agent/tools/jjhub-issue";
import type { RepoContext } from "../src/agent/types";
import { createMockServer, DEFAULT_TEST_TOKEN, withSandbox, writeConfig } from "./helpers";

const baseContext: RepoContext = {
  collectedAt: "2026-03-12T00:00:00Z",
  cwd: "/tmp/repo",
  repoRoot: "/tmp/repo",
  repoSlug: "alice/demo",
  repoSource: "detected",
  jjRemotes: {
    command: "jj git remote list",
    ok: true,
    output: "origin git@ssh.jjhub.tech:alice/demo.git",
    exitCode: 0,
  },
  jjStatus: {
    command: "jj status",
    ok: true,
    output: "Working copy changes:\nA hello.txt",
    exitCode: 0,
  },
  auth: {
    loggedIn: false,
    host: "jjhub.tech",
    verified: false,
    message: "Not logged in to jjhub.tech",
  },
  remoteRepo: {
    checked: false,
    message: "Skipped because JJHub auth is unavailable",
  },
  warnings: [],
};

async function withProcessEnv<T>(
  env: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(env)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("resolveIssueTargetRepo requires explicit configuration when unset", async () => {
  await withSandbox("jjhub-agent-issue-", async (sandbox) => {
    await withProcessEnv(
      {
        HOME: sandbox.cfgHome,
        JJHUB_DISABLE_SYSTEM_KEYRING: "1",
        XDG_CONFIG_HOME: sandbox.cfgHome,
        JJHUB_AGENT_ISSUE_REPO: undefined,
        JJHUB_TOKEN: undefined,
      },
      async () => {
        expect(() => resolveIssueTargetRepo()).toThrow("JJHUB_AGENT_ISSUE_REPO");
      },
    );
  });
});

test("jjhub_issue_create fails clearly when auth is missing", async () => {
  await withSandbox("jjhub-agent-issue-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech", "", {
      agent_issue_repo: "jjhub/platform",
    });

    await withProcessEnv(
      {
        HOME: sandbox.cfgHome,
        JJHUB_DISABLE_SYSTEM_KEYRING: "1",
        XDG_CONFIG_HOME: sandbox.cfgHome,
        JJHUB_AGENT_ISSUE_REPO: undefined,
        JJHUB_TOKEN: undefined,
      },
      async () => {
        const tool = createJjhubIssueTool({ current: baseContext });
        await expect(
          tool.execute("tool-call-1", {
            title: "Auth is missing",
            summary: "Trying to file without auth should fail clearly.",
          }, undefined, undefined, {} as never),
        ).rejects.toThrow("no token found");
      },
    );
  });
});

test("jjhub_issue_create files an issue in the configured JJHub repo", async () => {
  await withSandbox("jjhub-agent-issue-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/jjhub/platform/issues",
        assert({ request, json }) {
          expect(request.headers.get("authorization")).toBe(`token ${DEFAULT_TEST_TOKEN}`);
          const body = json<{ title: string; body: string }>();
          expect(body.title).toBe("Auth flow is confusing");
          expect(body.body).toContain("## Summary");
          expect(body.body).toContain("The CLI did not explain how to recover.");
          expect(body.body).toContain("- detected JJHub repo: alice/demo");
          expect(body.body).toContain("## Expected Behavior");
          expect(body.body).toContain("## Actual Behavior");
        },
        response: {
          status: 201,
          json: {
            number: 42,
            title: "Auth flow is confusing",
            html_url: "https://jjhub.tech/jjhub/platform/issues/42",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url, "", {
        agent_issue_repo: "jjhub/platform",
      });

      await withProcessEnv(
        {
          HOME: sandbox.cfgHome,
          JJHUB_DISABLE_SYSTEM_KEYRING: "1",
          JJHUB_TOKEN: DEFAULT_TEST_TOKEN,
          XDG_CONFIG_HOME: sandbox.cfgHome,
        },
        async () => {
          const tool = createJjhubIssueTool({ current: baseContext });
          const result = await tool.execute(
            "tool-call-2",
            {
              title: "Auth flow is confusing",
              summary: "The CLI did not explain how to recover.",
              expected_behavior: "The helper should point the user to browser login.",
              actual_behavior: "The helper replied without any JJHub-specific guidance.",
            },
            undefined,
            undefined,
            {} as never,
          );

          expect(result.content[0]?.type).toBe("text");
          expect((result.details as { number: number }).number).toBe(42);
        },
      );

      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
