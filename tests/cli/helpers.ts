import { expect, setDefaultTimeout } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const JJHUB_BIN = process.env.JJHUB_BIN;
export const JJHUB_ENTRY = join(import.meta.dir, "../../apps/cli/src/main.ts");
export const BUN_BIN = Bun.which("bun") ?? process.execPath;
export const JJ_BIN = process.env.JJ_BIN ?? "jj";
export const DEFAULT_TEST_TOKEN = "jjhub_testtoken";

setDefaultTimeout(15_000);

export type EnvOverrides = Record<string, string | undefined>;

export interface CommandResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

export interface RunOptions {
  cwd?: string;
  env?: EnvOverrides;
  stdin?: string;
  timeoutMs?: number;
}

export interface Sandbox {
  cfgHome: string;
  keyringFile: string;
  root: string;
  env(extra?: EnvOverrides): EnvOverrides;
  cleanup(): void;
}

export interface MockRequestContext {
  bodyText: string;
  json<T = unknown>(): T;
  query: URLSearchParams;
  request: Request;
  url: URL;
}

export interface MockRoute {
  method: string;
  path: string;
  times?: number;
  name?: string;
  assert?: (ctx: MockRequestContext) => void | Promise<void>;
  response?:
    | MockResponse
    | ((ctx: MockRequestContext) => MockResponse | Promise<MockResponse>);
}

export type MockResponse =
  | Response
  | {
      body?: string | null;
      headers?: HeadersInit;
      json?: unknown;
      status?: number;
    };

function buildEnv(overrides?: EnvOverrides): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (value === undefined) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }
  env.NO_COLOR = "1";
  env.CLICOLOR = "0";
  env.TERM = "dumb";
  return env;
}

export async function runCommand(
  command: string,
  args: string[],
  options: RunOptions = {},
): Promise<CommandResult> {
  const proc = Bun.spawn([command, ...args], {
    cwd: options.cwd,
    env: buildEnv(options.env),
    stdin: options.stdin !== undefined ? "pipe" : undefined,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdoutPromise = new Response(proc.stdout).text();
  const stderrPromise = new Response(proc.stderr).text();

  if (options.stdin !== undefined) {
    await proc.stdin!.write(options.stdin);
    await proc.stdin!.end();
  }

  const timeoutMs = options.timeoutMs ?? 30_000;
  let timedOut = false;
  const exitCode = await Promise.race([
    proc.exited,
    new Promise<number>((resolve) =>
      setTimeout(() => {
        timedOut = true;
        resolve(124);
      }, timeoutMs),
    ),
  ]);

  if (timedOut) {
    try {
      proc.kill();
    } catch {
      // Ignore kill errors if the process exited between the race and kill.
    }
    await proc.exited.catch(() => undefined);
  }

  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
  return {
    exitCode,
    stdout,
    stderr: timedOut ? `${stderr}\ncommand timed out after ${timeoutMs}ms` : stderr,
  };
}

export function configPaths(cfgHome: string): string[] {
  return [
    join(cfgHome, "jjhub", "config.toon"),
    join(cfgHome, ".config", "jjhub", "config.toon"),
    join(cfgHome, "Library", "Application Support", "jjhub", "config.toon"),
  ];
}

export function findExistingConfig(cfgHome: string): string | undefined {
  return configPaths(cfgHome).find((path) => existsSync(path));
}

export function writeConfig(
  cfgHome: string,
  apiUrl: string,
  token = DEFAULT_TEST_TOKEN,
  extra: Record<string, string> = {},
): void {
  const lines = [`api_url: ${apiUrl}`];
  if (token !== "") {
    lines.push(`token: ${token}`);
  }
  for (const [key, value] of Object.entries(extra)) {
    lines.push(`${key}: ${value}`);
  }
  const content = `${lines.join("\n")}\n`;
  for (const path of configPaths(cfgHome)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
}

export function readExistingConfigText(cfgHome: string): string | undefined {
  const configFile = findExistingConfig(cfgHome);
  if (!configFile) {
    return undefined;
  }
  return readFileSync(configFile, "utf8");
}

export function createSandbox(prefix = "jjhub-cli-bun-"): Sandbox {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const cfgHome = join(root, "cfg");
  const keyringFile = join(root, "keyring-store.json");
  mkdirSync(cfgHome, { recursive: true });

  return {
    root,
    cfgHome,
    keyringFile,
    env(extra: EnvOverrides = {}) {
      return {
        HOME: cfgHome,
        JJHUB_DISABLE_SYSTEM_KEYRING: "1",
        JJHUB_TEST_CREDENTIAL_STORE_FILE: undefined,
        JJHUB_TOKEN: undefined,
        XDG_CONFIG_HOME: cfgHome,
        ...extra,
      };
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

export async function withSandbox<T>(
  prefix: string,
  fn: (sandbox: Sandbox) => Promise<T> | T,
): Promise<T> {
  const sandbox = createSandbox(prefix);
  try {
    return await fn(sandbox);
  } finally {
    sandbox.cleanup();
  }
}

export async function runCli(
  args: string[],
  options: RunOptions = {},
): Promise<CommandResult> {
  if (JJHUB_BIN) {
    return runCommand(JJHUB_BIN, args, options);
  }

  return runCommand(BUN_BIN, [JJHUB_ENTRY, ...args], options);
}

export async function runJj(
  args: string[],
  options: RunOptions = {},
): Promise<CommandResult> {
  return runCommand(
    JJ_BIN,
    [
      "--color=never",
      "--no-pager",
      "--config",
      'user.name="Test User"',
      "--config",
      'user.email="test@example.com"',
      ...args,
    ],
    options,
  );
}

export async function initJjRepo(repoDir: string): Promise<void> {
  const result = await runJj(["git", "init"], { cwd: repoDir });
  expect(result.exitCode).toBe(0);
}

export function writeRepoFile(
  repoDir: string,
  relativePath: string,
  content: string,
): void {
  const path = join(repoDir, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

export async function createWorkingCopyCommit(
  repoDir: string,
  description: string,
  files: Array<[string, string]>,
  options: { baseRev?: string } = {},
): Promise<{ changeId: string; commitId: string }> {
  if (options.baseRev) {
    const newResult = await runJj(["new", options.baseRev], { cwd: repoDir });
    expect(newResult.exitCode).toBe(0);
  } else {
    const currentDescription = await runJj(
      ["log", "-r", "@", "--no-graph", "-T", "description.first_line() ++ \"\\n\""],
      { cwd: repoDir },
    );
    expect(currentDescription.exitCode).toBe(0);
    if (currentDescription.stdout.trim() !== "") {
      const newResult = await runJj(["new", "@"], { cwd: repoDir });
      expect(newResult.exitCode).toBe(0);
    }
  }

  for (const [path, content] of files) {
    writeRepoFile(repoDir, path, content);
  }

  const describeResult = await runJj(["describe", "-m", description], {
    cwd: repoDir,
  });
  expect(describeResult.exitCode).toBe(0);

  return {
    changeId: await currentChangeId(repoDir),
    commitId: await currentCommitId(repoDir),
  };
}

export async function currentChangeId(repoDir: string, revset = "@"): Promise<string> {
  const result = await runJj(
    ["log", "-r", revset, "--no-graph", "-T", "change_id ++ \"\\n\""],
    { cwd: repoDir },
  );
  expect(result.exitCode).toBe(0);
  return result.stdout.trim();
}

export async function currentCommitId(repoDir: string, revset = "@"): Promise<string> {
  const result = await runJj(
    ["log", "-r", revset, "--no-graph", "-T", "commit_id ++ \"\\n\""],
    { cwd: repoDir },
  );
  expect(result.exitCode).toBe(0);
  return result.stdout.trim();
}

export async function setWorkingCopy(repoDir: string, revset: string): Promise<void> {
  const result = await runJj(["edit", revset], { cwd: repoDir });
  expect(result.exitCode).toBe(0);
}

export async function createBookmark(
  repoDir: string,
  name: string,
  revset?: string,
): Promise<void> {
  const args = ["bookmark", "create", name];
  if (revset) {
    args.push("-r", revset);
  }
  const result = await runJj(args, { cwd: repoDir });
  expect(result.exitCode).toBe(0);
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function toResponse(input: MockResponse | undefined): Response {
  if (input instanceof Response) {
    return input;
  }
  if (!input) {
    return new Response(null, { status: 200 });
  }
  if (input.json !== undefined) {
    return jsonResponse(input.json, input.status ?? 200);
  }
  return new Response(input.body ?? null, {
    status: input.status ?? 200,
    headers: input.headers,
  });
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function createMockServer(routes: MockRoute[]) {
  const state = routes.map((route) => ({
    ...route,
    calls: 0,
    times: route.times ?? 1,
  }));
  const errors: Error[] = [];
  const requests: Array<{ body: string; method: string; path: string }> = [];

  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(request) {
      const url = new URL(request.url);
      const bodyText = await request.text();
      requests.push({ method: request.method, path: url.pathname, body: bodyText });

      const route = state.find(
        (candidate) =>
          candidate.calls < candidate.times &&
          candidate.method === request.method &&
          candidate.path === url.pathname,
      );

      if (!route) {
        return new Response(`No mock for ${request.method} ${url.pathname}`, {
          status: 501,
        });
      }

      route.calls += 1;
      const ctx: MockRequestContext = {
        request: new Request(request.url, {
          method: request.method,
          headers: request.headers,
          body: bodyText === "" ? undefined : bodyText,
        }),
        url,
        query: url.searchParams,
        bodyText,
        json<T = unknown>() {
          return JSON.parse(bodyText) as T;
        },
      };

      try {
        await route.assert?.(ctx);
        const response =
          typeof route.response === "function"
            ? await route.response(ctx)
            : route.response;
        return toResponse(response);
      } catch (error) {
        errors.push(toError(error));
        return new Response(`Mock assertion failed: ${toError(error).message}`, {
          status: 500,
        });
      }
    },
  });

  return {
    requests,
    url: `http://127.0.0.1:${server.port}`,
    assertSatisfied() {
      if (errors.length > 0) {
        throw errors[0];
      }
      const unmet = state.filter((route) => route.calls !== route.times);
      expect(unmet).toEqual([]);
    },
    stop() {
      server.stop(true);
    },
  };
}

export function expectQueryContains(
  query: URLSearchParams,
  expected: Record<string, string>,
): void {
  for (const [key, value] of Object.entries(expected)) {
    expect(query.get(key)).toBe(value);
  }
}

export function expectQueryExactly(
  query: URLSearchParams,
  expected: Record<string, string>,
): void {
  expect(Object.fromEntries(query.entries())).toEqual(expected);
}

export function expectJsonBody<T = unknown>(
  bodyText: string,
  expected?: unknown,
): T {
  const parsed = JSON.parse(bodyText) as T;
  if (expected !== undefined) {
    expect(parsed).toMatchObject(expected as Record<string, unknown>);
  }
  return parsed;
}

export function expectHeader(request: Request, name: string, value: string): void {
  expect(request.headers.get(name)).toBe(value);
}

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}
