import { expect, test } from "bun:test";
import {
  createMockServer,
  initJjRepo,
  readExistingConfigText,
  runCli,
  runJj,
  withSandbox,
  writeConfig,
} from "./helpers";

function uniqueTestHost(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}.test`;
}

function commandErrorText(result: { stderr: string; stdout: string }): string {
  return [result.stderr, result.stdout].filter(Boolean).join("\n");
}

test("auth status shows not logged in when no config", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    const result = await runCli(["auth", "status"], {
      cwd: sandbox.root,
      env: sandbox.env({ JJHUB_TOKEN: undefined }),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Not logged in");
  });
});

test("auth status shows logged in with legacy config token", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/user",
        assert({ request }) {
          expect(request.headers.get("authorization")).toBe(
            "token jjhub_legacy_status_token",
          );
        },
        response: { json: { login: "alice" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url, "jjhub_legacy_status_token");

      const result = await runCli(["auth", "status"], {
        cwd: sandbox.root,
        env: sandbox.env({ JJHUB_TOKEN: undefined }),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Logged in");
      expect(result.stdout).toContain("config file");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("auth status json format", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    const result = await runCli(["--json", "auth", "status"], {
      cwd: sandbox.root,
      env: sandbox.env({ JJHUB_TOKEN: undefined }),
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(parsed.logged_in).toBe(false);
    expect(typeof parsed.api_url).toBe("string");
    expect(parsed.token_set).toBe(false);
  });
});

test("auth status default output is human-readable", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    const result = await runCli(["auth", "status"], {
      cwd: sandbox.root,
      env: sandbox.env({ JJHUB_TOKEN: undefined }),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("logged_in: false");
    expect(result.stdout).toContain("token_set: false");
    expect(result.stdout.includes("{")).toBe(false);
  });
});

test("auth login with token rejects invalid prefix", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    const result = await runCli(["auth", "login", "--with-token"], {
      cwd: sandbox.root,
      env: sandbox.env({
        JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
        JJHUB_TOKEN: undefined,
      }),
      stdin: "invalid_token_without_prefix",
    });

    expect(result.exitCode).not.toBe(0);
    expect(commandErrorText(result)).toContain("jjhub_");
  });
});

test("auth login with token rejects empty", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    const result = await runCli(["auth", "login", "--with-token"], {
      cwd: sandbox.root,
      env: sandbox.env({
        JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
        JJHUB_TOKEN: undefined,
      }),
      stdin: "",
    });

    expect(result.exitCode).not.toBe(0);
    expect(commandErrorText(result)).toContain("no token");
  });
});

test("auth login with token stores credentials in keyring and not config", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    const result = await runCli(["auth", "login", "--with-token"], {
      cwd: sandbox.root,
      env: sandbox.env({
        JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
        JJHUB_TOKEN: undefined,
      }),
      stdin: "jjhub_secure_keyring_token_123",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Logged in");

    const config = readExistingConfigText(sandbox.cfgHome);
    expect(config).toBeDefined();
    expect(config?.includes("jjhub_secure_keyring_token_123")).toBe(false);

    const token = await runCli(["auth", "token"], {
      cwd: sandbox.root,
      env: sandbox.env({
        JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
        JJHUB_TOKEN: undefined,
      }),
    });
    expect(token.exitCode).toBe(0);
    expect(token.stdout.trim()).toBe("jjhub_secure_keyring_token_123");
    expect(token.stderr).toContain("keyring");
  });
});

test("auth login with hostname updates api url", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    const host = uniqueTestHost("login-host");
    const result = await runCli(
      ["auth", "login", "--with-token", "--hostname", host],
      {
        cwd: sandbox.root,
        env: sandbox.env({
          JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
          JJHUB_TOKEN: undefined,
        }),
        stdin: "jjhub_host_scoped_token",
      },
    );

    expect(result.exitCode).toBe(0);
    expect(readExistingConfigText(sandbox.cfgHome)).toContain(
      `api_url: https://api.${host}`,
    );
  });
});

test("auth login browser flow stores secure token", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/auth/github/cli",
        assert({ query }) {
          const port = Number(query.get("callback_port"));
          expect(Number.isInteger(port)).toBe(true);
          expect(port).toBeGreaterThan(1023);
        },
        response({ query }) {
          const port = query.get("callback_port");
          return new Response(null, {
            status: 302,
            headers: {
              location: `http://127.0.0.1:${port}/callback#token=jjhub_browser_login_token&username=alice`,
            },
          });
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url, "");

      const login = await runCli(["auth", "login"], {
        cwd: sandbox.root,
        env: sandbox.env({
          JJHUB_TEST_BROWSER_MODE: "fetch",
          JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
          JJHUB_TOKEN: undefined,
        }),
      });

      expect(login.exitCode).toBe(0);
      expect(login.stdout).toContain("Logged in");
      expect(login.stdout).toContain("alice");
      expect(
        readExistingConfigText(sandbox.cfgHome)?.includes(
          "jjhub_browser_login_token",
        ),
      ).toBe(false);

      const token = await runCli(["auth", "token"], {
        cwd: sandbox.root,
        env: sandbox.env({
          JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
          JJHUB_TOKEN: undefined,
        }),
      });
      expect(token.exitCode).toBe(0);
      expect(token.stdout.trim()).toBe("jjhub_browser_login_token");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("auth logout clears config token and preserves api url", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    writeConfig(
      sandbox.cfgHome,
      "https://custom.jjhub.tech",
      "jjhub_should_be_cleared",
    );

    const result = await runCli(["auth", "logout"], {
      cwd: sandbox.root,
      env: sandbox.env({ JJHUB_TOKEN: undefined }),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Logged out");
    const content = readExistingConfigText(sandbox.cfgHome);
    expect(content?.includes("jjhub_should_be_cleared")).toBe(false);
    expect(content).toContain("custom.jjhub.tech");
  });
});

test("auth logout deletes keyring token for hostname", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    const host = uniqueTestHost("logout-keyring");
    const login = await runCli(
      ["auth", "login", "--with-token", "--hostname", host],
      {
        cwd: sandbox.root,
        env: sandbox.env({
          JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
          JJHUB_TOKEN: undefined,
        }),
        stdin: "jjhub_logout_token_123",
      },
    );
    expect(login.exitCode).toBe(0);

    const logout = await runCli(["auth", "logout", "--hostname", host], {
      cwd: sandbox.root,
      env: sandbox.env({
        JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
        JJHUB_TOKEN: undefined,
      }),
    });
    expect(logout.exitCode).toBe(0);
    expect(logout.stdout).toContain(host);

    const token = await runCli(["auth", "token", "--hostname", host], {
      cwd: sandbox.root,
      env: sandbox.env({
        JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
        JJHUB_TOKEN: undefined,
      }),
    });

    expect(token.exitCode).not.toBe(0);
    expect(commandErrorText(token)).toContain("no token found");
  });
});

test("auth logout is idempotent", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    for (let index = 0; index < 2; index += 1) {
      const result = await runCli(["auth", "logout"], {
        cwd: sandbox.root,
        env: sandbox.env({ JJHUB_TOKEN: undefined }),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Logged out");
    }
  });
});

test("auth logout then status shows not logged in", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    const login = await runCli(["auth", "login", "--with-token"], {
      cwd: sandbox.root,
      env: sandbox.env({
        JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
        JJHUB_TOKEN: undefined,
      }),
      stdin: "jjhub_roundtrip_token",
    });
    expect(login.exitCode).toBe(0);

    const logout = await runCli(["auth", "logout"], {
      cwd: sandbox.root,
      env: sandbox.env({
        JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
        JJHUB_TOKEN: undefined,
      }),
    });
    expect(logout.exitCode).toBe(0);

    const status = await runCli(["auth", "status"], {
      cwd: sandbox.root,
      env: sandbox.env({
        JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
        JJHUB_TOKEN: undefined,
      }),
    });
    expect(status.exitCode).toBe(0);
    expect(status.stdout).toContain("Not logged in");
  });
});

test("auth token shows no token error", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    const result = await runCli(["auth", "token"], {
      cwd: sandbox.root,
      env: sandbox.env({ JJHUB_TOKEN: undefined }),
    });

    expect(result.exitCode).not.toBe(0);
    expect(commandErrorText(result)).toContain("no token found");
  });
});

test("auth token shows token from legacy config", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    writeConfig(
      sandbox.cfgHome,
      "https://api.jjhub.tech",
      "jjhub_my_secret_token",
    );

    const result = await runCli(["auth", "token"], {
      cwd: sandbox.root,
      env: sandbox.env({ JJHUB_TOKEN: undefined }),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("jjhub_my_secret_token");
    expect(result.stderr).toContain("config file");
  });
});

test("auth token shows token from env", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    const result = await runCli(["auth", "token"], {
      cwd: sandbox.root,
      env: sandbox.env({ JJHUB_TOKEN: "jjhub_env_token_123" }),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("jjhub_env_token_123");
    expect(result.stderr).toContain("JJHUB_TOKEN env");
  });
});

test("auth token json output is structured", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech", "jjhub_json_token");

    const result = await runCli(["--json", "auth", "token"], {
      cwd: sandbox.root,
      env: sandbox.env({ JJHUB_TOKEN: undefined }),
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(parsed.token).toBe("jjhub_json_token");
    expect(parsed.source).toBe("config file");
    expect(parsed.host).toBe("jjhub.tech");
  });
});

test("auth token env overrides config file", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    writeConfig(
      sandbox.cfgHome,
      "https://api.jjhub.tech",
      "jjhub_config_token",
    );

    const result = await runCli(["auth", "token"], {
      cwd: sandbox.root,
      env: sandbox.env({ JJHUB_TOKEN: "jjhub_env_wins" }),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("jjhub_env_wins");
  });
});

test("auth token reads secure token for hostname from keyring", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    const host = uniqueTestHost("token-keyring");
    const login = await runCli(
      ["auth", "login", "--with-token", "--hostname", host],
      {
        cwd: sandbox.root,
        env: sandbox.env({
          JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
          JJHUB_TOKEN: undefined,
        }),
        stdin: "jjhub_keyring_lookup_token",
      },
    );
    expect(login.exitCode).toBe(0);

    const token = await runCli(["auth", "token", "--hostname", host], {
      cwd: sandbox.root,
      env: sandbox.env({
        JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
        JJHUB_TOKEN: undefined,
      }),
    });

    expect(token.exitCode).toBe(0);
    expect(token.stdout.trim()).toBe("jjhub_keyring_lookup_token");
    expect(token.stderr).toContain("keyring");
    expect(token.stderr).toContain(host);
  });
});

test("auth status reports keyring source", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/user",
        assert({ request }) {
          expect(request.headers.get("authorization")).toBe(
            "token jjhub_status_keyring_token",
          );
        },
        response: { json: { login: "alice" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url, "");
      const login = await runCli(["auth", "login", "--with-token"], {
        cwd: sandbox.root,
        env: sandbox.env({
          JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
          JJHUB_TOKEN: undefined,
        }),
        stdin: "jjhub_status_keyring_token",
      });
      expect(login.exitCode).toBe(0);

      const status = await runCli(["auth", "status"], {
        cwd: sandbox.root,
        env: sandbox.env({
          JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
          JJHUB_TOKEN: undefined,
        }),
      });

      expect(status.exitCode).toBe(0);
      expect(status.stdout).toContain("via keyring");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("auth token stdout is pipeable", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech", "jjhub_pipe_test");

    const result = await runCli(["auth", "token"], {
      cwd: sandbox.root,
      env: sandbox.env({ JJHUB_TOKEN: undefined }),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("jjhub_pipe_test");
    expect(
      result.stdout.includes("config file") ||
        result.stdout.includes("Token source"),
    ).toBe(false);
  });
});

test("auth help includes claude subcommand", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    const result = await runCli(["auth", "--help"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("claude");
  });
});

test("auth claude login stores a setup token for status and token", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    const env = sandbox.env({
      ANTHROPIC_API_KEY: "",
      ANTHROPIC_AUTH_TOKEN: "",
      JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
    });
    const setupToken = "sk-ant-oat-test-flow-demo-token";

    const login = await runCli(["auth", "claude", "login"], {
      cwd: sandbox.root,
      env,
      stdin: setupToken,
    });
    expect(login.exitCode).toBe(0);
    expect(login.stdout).toContain("Stored Claude setup token");

    const status = await runCli(["auth", "claude", "status"], {
      cwd: sandbox.root,
      env,
    });
    expect(status.exitCode).toBe(0);
    expect(status.stdout).toContain("configured: true");
    expect(status.stdout).toContain("stored Claude subscription token");

    const token = await runCli(["auth", "claude", "token"], {
      cwd: sandbox.root,
      env,
    });
    expect(token.exitCode).toBe(0);
    expect(token.stdout.trim()).toBe(setupToken);
    expect(token.stderr).toContain("stored Claude subscription token");
    expect(token.stderr).toContain("ANTHROPIC_AUTH_TOKEN");
  });
});

test("auth claude token prefers env auth over stored setup token", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    const baseEnv = sandbox.env({
      ANTHROPIC_API_KEY: "",
      ANTHROPIC_AUTH_TOKEN: "",
      JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
    });

    const login = await runCli(["auth", "claude", "login"], {
      cwd: sandbox.root,
      env: baseEnv,
      stdin: "sk-ant-oat-stored-demo-token",
    });
    expect(login.exitCode).toBe(0);

    const token = await runCli(["auth", "claude", "token"], {
      cwd: sandbox.root,
      env: {
        ...baseEnv,
        ANTHROPIC_AUTH_TOKEN: "env-auth-token",
      },
    });
    expect(token.exitCode).toBe(0);
    expect(token.stdout.trim()).toBe("env-auth-token");
    expect(token.stderr).toContain("ANTHROPIC_AUTH_TOKEN env");
  });
});

test("auth claude token json output is structured", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    const env = sandbox.env({
      ANTHROPIC_API_KEY: "",
      ANTHROPIC_AUTH_TOKEN: "env-auth-token",
      JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
    });

    const result = await runCli(["--json", "auth", "claude", "token"], {
      cwd: sandbox.root,
      env,
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(parsed.token).toBe("env-auth-token");
    expect(parsed.env_key).toBe("ANTHROPIC_AUTH_TOKEN");
    expect(parsed.source).toBe("ANTHROPIC_AUTH_TOKEN env");
  });
});

test("auth claude push writes the active auth token to repository secrets", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/secrets",
        assert({ request, json }) {
          expect(request.headers.get("authorization")).toBe(
            "token jjhub_repo_secret_token",
          );
          expect(json<{ name: string; value: string }>()).toEqual({
            name: "ANTHROPIC_AUTH_TOKEN",
            value: "env-auth-token",
          });
        },
        response: { json: { name: "ANTHROPIC_AUTH_TOKEN" }, status: 201 },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url, "jjhub_repo_secret_token");

      const result = await runCli(
        ["auth", "claude", "push", "--repo", "alice/demo"],
        {
          cwd: sandbox.root,
          env: sandbox.env({
            ANTHROPIC_API_KEY: "",
            ANTHROPIC_AUTH_TOKEN: "env-auth-token",
            JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
          }),
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Pushed ANTHROPIC_AUTH_TOKEN");
      expect(result.stdout).toContain("alice/demo");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("auth claude login stores the setup token locally and pushes it to repository secrets", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    const setupToken = "sk-ant-oat-login-push-demo-token";
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/secrets",
        assert({ request, json }) {
          expect(request.headers.get("authorization")).toBe(
            "token jjhub_repo_secret_token",
          );
          expect(json<{ name: string; value: string }>()).toEqual({
            name: "ANTHROPIC_AUTH_TOKEN",
            value: setupToken,
          });
        },
        response: { json: { name: "ANTHROPIC_AUTH_TOKEN" }, status: 201 },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url, "jjhub_repo_secret_token");

      const env = sandbox.env({
        ANTHROPIC_API_KEY: "",
        ANTHROPIC_AUTH_TOKEN: "",
        JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
      });

      const login = await runCli(
        ["auth", "claude", "login", "--repo", "alice/demo"],
        {
          cwd: sandbox.root,
          env,
          stdin: setupToken,
        },
      );
      expect(login.exitCode).toBe(0);
      expect(login.stdout).toContain(
        "Stored Claude setup token in keyring and pushed ANTHROPIC_AUTH_TOKEN to alice/demo.",
      );

      const token = await runCli(["auth", "claude", "token"], {
        cwd: sandbox.root,
        env,
      });
      expect(token.exitCode).toBe(0);
      expect(token.stdout.trim()).toBe(setupToken);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("auth claude login keeps local success when implicit repo push cannot authenticate", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    await initJjRepo(sandbox.root);
    const remote = await runJj(
      ["git", "remote", "add", "origin", "git@ssh.jjhub.tech:alice/demo.git"],
      { cwd: sandbox.root },
    );
    expect(remote.exitCode).toBe(0);

    const env = sandbox.env({
      ANTHROPIC_API_KEY: "",
      ANTHROPIC_AUTH_TOKEN: "",
      JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
    });
    const setupToken = "sk-ant-oat-implicit-push-demo-token";

    const login = await runCli(["auth", "claude", "login"], {
      cwd: sandbox.root,
      env,
      stdin: setupToken,
    });
    expect(login.exitCode).toBe(0);
    expect(login.stdout).toContain(
      "Stored Claude setup token in keyring, but automatic repository secret push failed:",
    );

    const token = await runCli(["auth", "claude", "token"], {
      cwd: sandbox.root,
      env,
    });
    expect(token.exitCode).toBe(0);
    expect(token.stdout.trim()).toBe(setupToken);
  });
});

test("auth claude logout clears the stored setup token", async () => {
  await withSandbox("jjhub-auth-", async (sandbox) => {
    const env = sandbox.env({
      ANTHROPIC_API_KEY: "",
      ANTHROPIC_AUTH_TOKEN: "",
      JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
    });

    const login = await runCli(["auth", "claude", "login"], {
      cwd: sandbox.root,
      env,
      stdin: "sk-ant-oat-logout-demo-token",
    });
    expect(login.exitCode).toBe(0);

    const logout = await runCli(["auth", "claude", "logout"], {
      cwd: sandbox.root,
      env,
    });
    expect(logout.exitCode).toBe(0);
    expect(logout.stdout).toContain("Cleared stored Claude setup token");

    const token = await runCli(["auth", "claude", "token"], {
      cwd: sandbox.root,
      env,
    });
    expect(token.exitCode).not.toBe(0);
    expect(commandErrorText(token)).toContain("no Claude Code auth found");
  });
});
