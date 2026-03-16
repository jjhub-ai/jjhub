import { expect, test } from "bun:test";
import {
  readExistingConfigText,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

test("config get returns api_url", async () => {
  await withSandbox("jjhub-config-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech");
    const result = await runCli(["config", "get", "api_url", "--json"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(parsed.api_url).toBe("https://api.jjhub.tech");
  });
});

test("config set updates api_url", async () => {
  await withSandbox("jjhub-config-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech");
    const result = await runCli(
      ["config", "set", "api_url", "https://custom.example.com", "--json"],
      { cwd: sandbox.root, env: sandbox.env() },
    );

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(parsed.set).toBe("api_url");
    expect(parsed.value).toBe("https://custom.example.com");

    const configText = readExistingConfigText(sandbox.cfgHome);
    expect(configText).toContain("https://custom.example.com");
  });
});

test("config set git_protocol to ssh succeeds", async () => {
  await withSandbox("jjhub-config-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech");
    const result = await runCli(
      ["config", "set", "git_protocol", "ssh", "--json"],
      { cwd: sandbox.root, env: sandbox.env() },
    );

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(parsed.value).toBe("ssh");
  });
});

test("config set git_protocol to invalid value fails", async () => {
  await withSandbox("jjhub-config-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech");
    const result = await runCli(
      ["config", "set", "git_protocol", "ftp"],
      { cwd: sandbox.root, env: sandbox.env() },
    );

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("ssh");
    expect(result.stderr).toContain("https");
  });
});

test("config get unknown key fails", async () => {
  await withSandbox("jjhub-config-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech");
    const result = await runCli(["config", "get", "nonexistent"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Unknown config key");
  });
});

test("config list returns all config values", async () => {
  await withSandbox("jjhub-config-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech");
    const result = await runCli(["config", "list", "--json"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(parsed.api_url).toBe("https://api.jjhub.tech");
    expect("git_protocol" in parsed).toBe(true);
  });
});
