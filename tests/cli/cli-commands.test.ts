import { expect, test } from "bun:test";
import { runCli, withSandbox } from "./helpers";

test("label list requires repo context", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["label", "list"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
  });
});

test("label create requires name arg", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["label", "create"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
    expect(
      result.stderr.includes("name") ||
        result.stderr.includes("expected") ||
        result.stderr.includes("Usage"),
    ).toBe(true);
  });
});

test("search repos requires query arg", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["search", "repos"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
    expect(
      result.stderr.includes("query") ||
        result.stderr.includes("expected") ||
        result.stderr.includes("Usage"),
    ).toBe(true);
  });
});

test("search issues requires query arg", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["search", "issues"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
  });
});

test("secret set requires name and value", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["secret", "set"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
    expect(
      result.stderr.includes("name") ||
        result.stderr.includes("required") ||
        result.stderr.includes("Usage"),
    ).toBe(true);
  });
});

test("secret list fails without auth", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["secret", "list"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
  });
});

test("secret delete requires name arg", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["secret", "delete"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
    expect(
      result.stderr.includes("name") ||
        result.stderr.includes("required") ||
        result.stderr.includes("Usage"),
    ).toBe(true);
  });
});

test("variable set requires name and value", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["variable", "set"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
    expect(
      result.stderr.includes("name") ||
        result.stderr.includes("required") ||
        result.stderr.includes("Usage"),
    ).toBe(true);
  });
});

test("variable get requires name arg", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["variable", "get"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
    expect(
      result.stderr.includes("name") ||
        result.stderr.includes("required") ||
        result.stderr.includes("Usage"),
    ).toBe(true);
  });
});

test("variable list fails without auth", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["variable", "list"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
  });
});

test("variable delete requires name arg", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["variable", "delete"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
    expect(
      result.stderr.includes("name") ||
        result.stderr.includes("required") ||
        result.stderr.includes("Usage"),
    ).toBe(true);
  });
});

test("bookmark create requires name arg", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["bookmark", "create"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
    expect(
      result.stderr.includes("name") ||
        result.stderr.includes("required") ||
        result.stderr.includes("Usage") ||
        result.stderr.includes("jj workspace") ||
        result.stderr.includes("not a jj"),
    ).toBe(true);
  });
});

test("bookmark delete requires name arg", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["bookmark", "delete"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
    expect(
      result.stderr.includes("name") ||
        result.stderr.includes("required") ||
        result.stderr.includes("Usage") ||
        result.stderr.includes("jj workspace") ||
        result.stderr.includes("not a jj"),
    ).toBe(true);
  });
});

test("search code requires auth", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["search", "code", "test-query"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
  });
});

test("label delete requires id arg", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["label", "delete"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
    expect(
      result.stderr.includes("expected") ||
        result.stderr.includes("invalid") ||
        result.stderr.includes("Usage"),
    ).toBe(true);
  });
});

test("agent chat requires session id and message", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["agent", "chat"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    const output = `${result.stdout}${result.stderr}`;
    expect(result.exitCode).not.toBe(0);
    expect(output.includes("not yet implemented")).toBe(false);
  });
});

test("agent run requires prompt arg", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["agent", "run"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    const output = `${result.stdout}${result.stderr}`;
    expect(result.exitCode).not.toBe(0);
    expect(output.includes("not yet implemented")).toBe(false);
    expect(
      output.includes("prompt") ||
        output.includes("required") ||
        output.includes("Usage"),
    ).toBe(true);
  });
});

test("run list requires repo context", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["run", "list"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    const output = `${result.stdout}${result.stderr}`;
    expect(result.exitCode).not.toBe(0);
    expect(output.includes("not yet implemented")).toBe(false);
    expect(
      output.includes("repository") ||
        output.includes("required") ||
        output.includes("Usage"),
    ).toBe(true);
  });
});

test("run view requires run id arg", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["run", "view"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    const output = `${result.stdout}${result.stderr}`;
    expect(result.exitCode).not.toBe(0);
    expect(output.includes("not yet implemented")).toBe(false);
    expect(
      output.includes("run_id") ||
        output.includes("expected number") ||
        output.includes("required") ||
        output.includes("Usage"),
    ).toBe(true);
  });
});

test("run watch requires run id arg", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["run", "watch"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    const output = `${result.stdout}${result.stderr}`;
    expect(result.exitCode).not.toBe(0);
    expect(output.includes("not yet implemented")).toBe(false);
    expect(
      output.includes("run_id") ||
        output.includes("expected number") ||
        output.includes("required") ||
        output.includes("Usage"),
    ).toBe(true);
  });
});

test("run rerun requires run id arg", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["run", "rerun"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    const output = `${result.stdout}${result.stderr}`;
    expect(result.exitCode).not.toBe(0);
    expect(
      output.includes("run_id") ||
        output.includes("expected number") ||
        output.includes("required") ||
        output.includes("Usage"),
    ).toBe(true);
  });
});

test("workflow list requires repo context", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["workflow", "list"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
  });
});

test("workflow run requires workflow id arg", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["workflow", "run"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    const output = `${result.stdout}${result.stderr}`;
    expect(result.exitCode).not.toBe(0);
    expect(output.includes("not yet implemented")).toBe(false);
    expect(
      output.includes("workflow_id") ||
        output.includes("workflow") ||
        output.includes("required") ||
        output.includes("Usage"),
    ).toBe(true);
  });
});

test("ssh key add requires title and key", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["ssh-key", "add"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
    expect(
      result.stderr.includes("title") ||
        result.stderr.includes("required") ||
        result.stderr.includes("Usage"),
    ).toBe(true);
  });
});

test("ssh key list exits nonzero without auth", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["ssh-key", "list"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
    expect(
      result.stderr.includes("not authenticated") || result.stderr.includes("auth"),
    ).toBe(true);
  });
});

test("ssh key delete requires id arg", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["ssh-key", "delete"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
  });
});

test("config list succeeds with defaults", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["config", "list"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("api_url");
    expect(result.stdout).toContain("git_protocol");
  });
});

test("config get requires key arg", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["config", "get"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
  });
});

test("config set requires key and value", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["config", "set"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.includes("not yet implemented")).toBe(false);
  });
});

test("config get api url returns value", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["config", "get", "api_url"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).toBe(0);
    expect(
      result.stdout.includes("jjhub.tech") || result.stdout.includes("localhost"),
    ).toBe(true);
  });
});

test("config set and get roundtrip", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const setResult = await runCli(["config", "set", "git_protocol", "https"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(setResult.exitCode).toBe(0);

    const getResult = await runCli(["config", "get", "git_protocol"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(getResult.exitCode).toBe(0);
    expect(getResult.stdout).toContain("https");
  });
});

test("config get unknown key returns error", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["config", "get", "nonexistent_key"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Unknown config key");
  });
});

test("implemented commands with json flag fail without auth", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    for (const args of [
      ["--json", "secret", "list"],
      ["--json", "variable", "list"],
      ["--toon", "secret", "list"],
      ["--toon", "variable", "list"],
    ]) {
      const result = await runCli(args, {
        cwd: sandbox.root,
        env: sandbox.env(),
      });
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.includes("not yet implemented")).toBe(false);
    }
  });
});

test("all commands have working help", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    for (const [args, expected] of [
      [["label", "--help"], "label"],
      [["search", "--help"], "search"],
      [["secret", "--help"], "secret"],
      [["variable", "--help"], "variable"],
      [["agent", "--help"], "agent"],
      [["run", "--help"], "run"],
      [["workflow", "--help"], "workflow"],
      [["ssh-key", "--help"], "ssh-key"],
      [["config", "--help"], "config"],
      [["api", "--help"], "api"],
    ] as Array<[string[], string]>) {
      const result = await runCli(args, {
        cwd: sandbox.root,
        env: sandbox.env(),
      });
      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain(expected);
    }
  });
});

test("completion bash generates output", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["completion", "bash"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(0);
    expect(
      result.stdout.includes("jjhub") ||
        result.stdout.includes("_jjhub") ||
        result.stdout.includes("complete"),
    ).toBe(true);
  });
});

test("completion zsh generates output", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["completion", "zsh"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(0);
  });
});

test("completion fish generates output", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["completion", "fish"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(0);
  });
});

test("commands without subcommand show help", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    for (const command of [
      "label",
      "search",
      "secret",
      "variable",
      "run",
      "workflow",
      "ssh-key",
      "config",
    ]) {
      const result = await runCli([command], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });
      expect(
        `${result.stdout}${result.stderr}`.match(/Usage|usage|USAGE/),
      ).toBeTruthy();
    }
  });
});

test("top level help lists all commands", async () => {
  await withSandbox("jjhub-commands-", async (sandbox) => {
    const result = await runCli(["--help"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });
    expect(result.exitCode).toBe(0);
    for (const command of [
      "search",
      "workflow",
      "run",
      "agent",
      "secret",
      "variable",
      "ssh-key",
      "config",
      "label",
      "api",
      "completion",
    ]) {
      expect(result.stdout).toContain(command);
    }
  });
});
