import { expect, test } from "bun:test";
import {
  BUN_BIN,
  createMockServer,
  expectHeader,
  expectJsonBody,
  runCli,
  withSandbox,
  writeConfig,
  writeRepoFile,
} from "./helpers";

// Actual constants from workspace.ts (not from the bootstrap contract,
// which describes a different deployment surface)
const REMOTE_CLAUDE_AUTH_FILE = "/home/developer/.jjhub/claude-env.sh";
const REMOTE_WORKSPACE_ROOT = "/home/developer/workspace";
const REMOTE_WORKSPACE_USER = "developer";
const REMOTE_LOCAL_NODE_DIR = "/home/developer/.local/node";
const REMOTE_LOCAL_BIN_DIR = "/home/developer/.local/bin";
const CLAUDE_CODE_PACKAGE = "@anthropic-ai/claude-code";

function commandErrorText(result: { stderr: string; stdout: string }): string {
  return [result.stderr, result.stdout].filter(Boolean).join("\n");
}

function createFakeSSHScript(root: string): { logPath: string; scriptPath: string } {
  const logPath = `${root}/fake-ssh.log`;
  const scriptPath = `${root}/fake-ssh.ts`;
  writeRepoFile(
    root,
    "fake-ssh.ts",
    [
      'import { appendFileSync } from "node:fs";',
      "",
      'const logPath = process.env.JJHUB_FAKE_SSH_LOG_PATH;',
      'const authCheckReady = process.env.JJHUB_FAKE_SSH_AUTH_CHECK_READY === "1";',
      'const claudeOutput = process.env.JJHUB_FAKE_SSH_CLAUDE_OUTPUT ?? "";',
      'const claudeHangMs = Number.parseInt(process.env.JJHUB_FAKE_SSH_HANG_CLAUDE_MS ?? "0", 10) || 0;',
      'const diagnosticsOutput = process.env.JJHUB_FAKE_SSH_DIAGNOSTICS ?? "";',
      'const changeIDs = process.env.JJHUB_FAKE_SSH_CHANGE_IDS ?? "";',
      "const args = process.argv.slice(2);",
      "",
      "if (!logPath) {",
      '  throw new Error("JJHUB_FAKE_SSH_LOG_PATH is required");',
      "}",
      "",
      'const stdin = await new Response(Bun.stdin.stream()).text();',
      'appendFileSync(logPath, `${JSON.stringify({ args, stdin })}\\n`);',
      'const beginMarker = stdin.match(/__JJHUB_BEGIN_[^_\\s]+__/)?.[0] ?? "__JJHUB_BEGIN__";',
      'const endMarker = stdin.match(/__JJHUB_END_[^_\\s]+__/)?.[0] ?? "__JJHUB_END__";',
      'let body = "";',
      'if (stdin.includes("jj log -r ")) {',
      "  body = changeIDs;",
      '} else if (stdin.includes("printf ready")) {',
      '  body = authCheckReady ? "ready\\n" : "";',
      '} else if (stdin.includes("claude_processes:")) {',
      "  body = diagnosticsOutput;",
      '} else if (stdin.includes("claude -p")) {',
      "  if (claudeHangMs > 0) {",
      "    await Bun.sleep(claudeHangMs);",
      "  }",
      "  body = claudeOutput;",
      "}",
      'if (body.length > 0 && !body.endsWith("\\n")) {',
      '  body = `${body}\\n`;',
      "}",
      'process.stdout.write(`Linux fake-vm 6.1.0\\n${beginMarker}\\n${body}${endMarker}:0\\n`);',
      "",
    ].join("\n"),
  );
  return { logPath, scriptPath };
}

test("workspace issue polls for SSH readiness and creates a landing request from real change IDs", async () => {
  await withSandbox("jjhub-workspace-issue-", async (sandbox) => {
    const { logPath, scriptPath } = createFakeSSHScript(sandbox.root);
    const sshCommand = `${BUN_BIN} ${scriptPath}`;
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/issues/7",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: {
          json: {
            number: 7,
            title: "Fix flaky workspace issue",
            body: "Make the command reliable.",
            state: "open",
            labels: [{ name: "cli" }, { name: "workspace" }],
          },
        },
      },
      {
        method: "POST",
        path: "/api/repos/alice/demo/workspaces",
        assert({ bodyText }) {
          expectJsonBody(bodyText, { name: "issue-7" });
        },
        response: {
          status: 201,
          json: {
            id: "ws_issue_7",
            status: "running",
          },
        },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_issue_7/ssh",
        response: {
          json: {
            host: "vm-ssh.jjhub.tech",
          },
        },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_issue_7/ssh",
        response: {
          json: {
            host: "vm-ssh.jjhub.tech",
          },
        },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_issue_7/ssh",
        response: {
          json: {
            command: sshCommand,
            host: "vm-ssh.jjhub.tech",
          },
        },
      },
      {
        method: "POST",
        path: "/api/repos/alice/demo/landings",
        assert({ bodyText }) {
          expectJsonBody(bodyText, {
            title: "fix: Fix flaky workspace issue (#7)",
            body: "Closes #7\n\nMake the command reliable.",
            target_bookmark: "main",
            change_ids: ["chg-base", "chg-top"],
          });
        },
        response: {
          status: 201,
          json: {
            number: 42,
            title: "fix: Fix flaky workspace issue (#7)",
            state: "open",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["--json", "workspace", "issue", "7", "-R", "alice/demo"],
        {
          cwd: sandbox.root,
          env: sandbox.env({
            ANTHROPIC_AUTH_TOKEN: "anthropic-test-token",
            JJHUB_FAKE_SSH_CHANGE_IDS: "chg-base\nchg-top\n",
            JJHUB_FAKE_SSH_LOG_PATH: logPath,
            JJHUB_WORKSPACE_SSH_POLL_INTERVAL_MS: "1",
            JJHUB_WORKSPACE_SSH_POLL_TIMEOUT_MS: "50",
          }),
          timeoutMs: 10_000,
        },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.workspace_id).toBe("ws_issue_7");
      expect(parsed.landing_request).toBe(42);
      expect(parsed.change_ids).toEqual(["chg-base", "chg-top"]);

      const sshPollRequests = server.requests.filter(
        (request) =>
          request.method === "GET" &&
          request.path === "/api/repos/alice/demo/workspaces/ws_issue_7/ssh",
      );
      expect(sshPollRequests).toHaveLength(3);

      const sshInvocations = Bun.file(logPath).text();
      const lines = (await sshInvocations).trim().split("\n").filter(Boolean);
      expect(lines).toHaveLength(3);

      const authSeedCall = JSON.parse(lines[0]) as { args: string[]; stdin: string };
      const claudeCall = JSON.parse(lines[1]) as { args: string[]; stdin: string };
      const jjLogCall = JSON.parse(lines[2]) as { args: string[]; stdin: string };
      expect(authSeedCall.stdin).toContain("ANTHROPIC_AUTH_TOKEN");
      expect(authSeedCall.stdin).toContain("anthropic-test-token");
      expect(authSeedCall.stdin).toContain(REMOTE_CLAUDE_AUTH_FILE);
      expect(claudeCall.stdin).toContain(`cd '${REMOTE_WORKSPACE_ROOT}'`);
      expect(claudeCall.stdin).toContain("npm install -g");
      expect(claudeCall.stdin).toContain(CLAUDE_CODE_PACKAGE);
      expect(claudeCall.stdin).toContain(REMOTE_LOCAL_NODE_DIR);
      expect(claudeCall.stdin).toContain("ln -sfn ../node/bin/node");
      expect(claudeCall.stdin).toContain(REMOTE_CLAUDE_AUTH_FILE);
      expect(claudeCall.stdin).toContain(`runuser -u '${REMOTE_WORKSPACE_USER}'`);
      expect(claudeCall.stdin).toContain('process.argv[1], "base64"');
      expect(claudeCall.stdin).toContain("claude -p --dangerously-skip-permissions");
      expect(claudeCall.stdin).toContain("--output-format json");
      expect(claudeCall.stdin).not.toContain("--prompt");
      expect(jjLogCall.stdin).toContain("jj log -r");
      expect(jjLogCall.stdin).toContain('bookmarks(exact:"main")');

      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workspace issue skips landing request creation when no workspace changes are detected", async () => {
  await withSandbox("jjhub-workspace-issue-", async (sandbox) => {
    const { logPath, scriptPath } = createFakeSSHScript(sandbox.root);
    const sshCommand = `${BUN_BIN} ${scriptPath}`;
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/issues/8",
        response: {
          json: {
            number: 8,
            title: "No-op issue",
            body: "Investigate and report back.",
            state: "open",
          },
        },
      },
      {
        method: "POST",
        path: "/api/repos/alice/demo/workspaces",
        response: {
          status: 201,
          json: {
            id: "ws_issue_8",
            status: "running",
          },
        },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_issue_8/ssh",
        response: {
          json: {
            command: sshCommand,
            host: "vm-ssh.jjhub.tech",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["--json", "workspace", "issue", "8", "-R", "alice/demo"],
        {
          cwd: sandbox.root,
          env: sandbox.env({
            ANTHROPIC_AUTH_TOKEN: "anthropic-test-token",
            JJHUB_FAKE_SSH_CHANGE_IDS: "",
            JJHUB_FAKE_SSH_LOG_PATH: logPath,
            JJHUB_WORKSPACE_SSH_POLL_INTERVAL_MS: "1",
            JJHUB_WORKSPACE_SSH_POLL_TIMEOUT_MS: "50",
          }),
          timeoutMs: 10_000,
        },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.workspace_id).toBe("ws_issue_8");
      expect(parsed.status).toBe("completed");
      expect(parsed.message).toBe(
        "Claude Code session ended. No non-empty changes were detected relative to main, so no landing request was created.",
      );
      expect(
        server.requests.some(
          (request) =>
            request.method === "POST" &&
            request.path === "/api/repos/alice/demo/landings",
        ),
      ).toBe(false);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workspace issue seeds Claude auth from the local Claude Code keychain payload", async () => {
  await withSandbox("jjhub-workspace-issue-", async (sandbox) => {
    const { logPath, scriptPath } = createFakeSSHScript(sandbox.root);
    const sshCommand = `${BUN_BIN} ${scriptPath}`;
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/issues/10",
        response: {
          json: {
            number: 10,
            title: "Keychain auth",
            body: "Use the Claude Code OAuth token.",
            state: "open",
          },
        },
      },
      {
        method: "POST",
        path: "/api/repos/alice/demo/workspaces",
        response: {
          status: 201,
          json: {
            id: "ws_issue_10",
            status: "running",
          },
        },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_issue_10/ssh",
        response: {
          json: {
            command: sshCommand,
            host: "vm-ssh.jjhub.tech",
          },
        },
      },
      {
        method: "POST",
        path: "/api/repos/alice/demo/landings",
        response: {
          status: 201,
          json: {
            number: 99,
            title: "fix: Keychain auth (#10)",
            state: "open",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["--json", "workspace", "issue", "10", "-R", "alice/demo"],
        {
          cwd: sandbox.root,
          env: sandbox.env({
            ANTHROPIC_API_KEY: "",
            ANTHROPIC_AUTH_TOKEN: "",
            JJHUB_FAKE_SSH_CHANGE_IDS: "chg-keychain\n",
            JJHUB_FAKE_SSH_LOG_PATH: logPath,
            JJHUB_TEST_CLAUDE_KEYCHAIN_PAYLOAD:
              '{"claudeAiOauth":{"accessToken":"oauth-token-from-keychain"}}',
            JJHUB_WORKSPACE_SSH_POLL_INTERVAL_MS: "1",
            JJHUB_WORKSPACE_SSH_POLL_TIMEOUT_MS: "50",
          }),
          timeoutMs: 10_000,
        },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.workspace_id).toBe("ws_issue_10");
      expect(parsed.landing_request).toBe(99);

      const sshInvocations = Bun.file(logPath).text();
      const lines = (await sshInvocations).trim().split("\n").filter(Boolean);
      expect(lines).toHaveLength(3);

      const authSeedCall = JSON.parse(lines[0]) as { args: string[]; stdin: string };
      expect(authSeedCall.stdin).toContain("ANTHROPIC_AUTH_TOKEN");
      expect(authSeedCall.stdin).toContain("oauth-token-from-keychain");

      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workspace issue fails before launching Claude when no Anthropic auth is available", async () => {
  await withSandbox("jjhub-workspace-issue-", async (sandbox) => {
    const { logPath, scriptPath } = createFakeSSHScript(sandbox.root);
    const sshCommand = `${BUN_BIN} ${scriptPath}`;
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/issues/9",
        response: {
          json: {
            number: 9,
            title: "Auth required",
            body: "Needs Claude auth.",
            state: "open",
          },
        },
      },
      {
        method: "POST",
        path: "/api/repos/alice/demo/workspaces",
        response: {
          status: 201,
          json: {
            id: "ws_issue_9",
            status: "running",
          },
        },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_issue_9/ssh",
        response: {
          json: {
            command: sshCommand,
            host: "vm-ssh.jjhub.tech",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["workspace", "issue", "9", "-R", "alice/demo"],
        {
          cwd: sandbox.root,
          env: sandbox.env({
            ANTHROPIC_API_KEY: "",
            ANTHROPIC_AUTH_TOKEN: "",
            JJHUB_FAKE_SSH_LOG_PATH: logPath,
            JJHUB_WORKSPACE_SSH_POLL_INTERVAL_MS: "1",
            JJHUB_WORKSPACE_SSH_POLL_TIMEOUT_MS: "50",
          }),
          timeoutMs: 10_000,
        },
      );

      expect(result.exitCode).toBe(1);
      expect(
        server.requests.some(
          (request) =>
            request.method === "POST" &&
            request.path === "/api/repos/alice/demo/landings",
        ),
      ).toBe(false);

      const sshInvocations = Bun.file(logPath).text();
      const lines = (await sshInvocations).trim().split("\n").filter(Boolean);
      expect(lines).toHaveLength(1);
      const authCheckCall = JSON.parse(lines[0]) as { args: string[]; stdin: string };
      expect(authCheckCall.stdin).toContain(REMOTE_CLAUDE_AUTH_FILE);
      expect(authCheckCall.stdin).toContain("printf ready");
      expect(commandErrorText(result)).toContain("ANTHROPIC_AUTH_TOKEN");
      expect(commandErrorText(result)).toContain("ANTHROPIC_API_KEY");
      expect(commandErrorText(result)).toContain("claude login");
      expect(commandErrorText(result)).toContain("jjhub workspace issue");

      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workspace issue reports workspace diagnostics when Claude times out", async () => {
  await withSandbox("jjhub-workspace-issue-", async (sandbox) => {
    const { logPath, scriptPath } = createFakeSSHScript(sandbox.root);
    const sshCommand = `${BUN_BIN} ${scriptPath}`;
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/issues/11",
        response: {
          json: {
            number: 11,
            title: "Timeout diagnostics",
            body: "Exercise the claude timeout path.",
            state: "open",
          },
        },
      },
      {
        method: "POST",
        path: "/api/repos/alice/demo/workspaces",
        response: {
          status: 201,
          json: {
            id: "ws_issue_11",
            status: "running",
          },
        },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_issue_11/ssh",
        response: {
          json: {
            command: sshCommand,
            host: "vm-ssh.jjhub.tech",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["workspace", "issue", "11", "-R", "alice/demo"],
        {
          cwd: sandbox.root,
          env: sandbox.env({
            ANTHROPIC_AUTH_TOKEN: "anthropic-test-token",
            JJHUB_FAKE_SSH_DIAGNOSTICS: "claude_processes:\n2428 2411 Sl+ ep_pol claude\n",
            JJHUB_FAKE_SSH_HANG_CLAUDE_MS: "200",
            JJHUB_FAKE_SSH_LOG_PATH: logPath,
            JJHUB_WORKSPACE_CLAUDE_TIMEOUT_MS: "50",
            JJHUB_WORKSPACE_SSH_POLL_INTERVAL_MS: "1",
            JJHUB_WORKSPACE_SSH_POLL_TIMEOUT_MS: "50",
          }),
          timeoutMs: 10_000,
        },
      );

      expect(result.exitCode).toBe(1);
      const combinedOutput = `${result.stdout}\n${result.stderr}`;
      expect(combinedOutput).toContain("Workspace diagnostics:");
      expect(combinedOutput).toContain("claude_processes:");
      expect(combinedOutput).toContain("ep_pol");

      const sshInvocations = Bun.file(logPath).text();
      const lines = (await sshInvocations).trim().split("\n").filter(Boolean);
      expect(lines).toHaveLength(3);

      const diagnosticCall = JSON.parse(lines[2]) as { args: string[]; stdin: string };
      expect(diagnosticCall.stdin).toContain("claude_processes:");
      expect(diagnosticCall.stdin).toContain("node --version");
      expect(diagnosticCall.stdin).toContain("node_install_log:");
      expect(diagnosticCall.stdin).toContain("claude_install_log:");

      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
