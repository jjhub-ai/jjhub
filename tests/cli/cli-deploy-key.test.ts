import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  expectJsonBody,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const DEPLOY_KEY_RESPONSE = {
  id: 1,
  key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKtest",
  title: "CI deploy key",
  read_only: true,
  created_at: "2026-02-19T00:00:00Z",
};

test("deploy key add via api command", async () => {
  await withSandbox("jjhub-dk-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/repos/alice/demo/keys",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expectJsonBody(bodyText, {
            title: "CI deploy key",
            key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKtest",
          });
        },
        response: { status: 201, json: DEPLOY_KEY_RESPONSE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        [
          "api", "/repos/alice/demo/keys", "--method", "POST", "--json",
          "--field", "title=CI deploy key",
          "--field", "key=ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKtest",
          "--field", "read_only=true",
        ],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.id).toBe(1);
      expect(parsed.title).toBe("CI deploy key");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("deploy key list via api command", async () => {
  await withSandbox("jjhub-dk-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/repos/alice/demo/keys",
        response: {
          json: [
            DEPLOY_KEY_RESPONSE,
            { ...DEPLOY_KEY_RESPONSE, id: 2, title: "Production key", read_only: false },
          ],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["api", "/repos/alice/demo/keys", "--method", "GET", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(parsed).toHaveLength(2);
      expect(parsed[0]?.title).toBe("CI deploy key");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("deploy key delete via api command", async () => {
  await withSandbox("jjhub-dk-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/repos/alice/demo/keys/1",
        response: { status: 204, body: null },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["api", "/repos/alice/demo/keys/1", "--method", "DELETE"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("deploy key add without required fields fails", async () => {
  await withSandbox("jjhub-dk-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/repos/alice/demo/keys",
        response: {
          status: 422,
          json: { message: "key is required" },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["api", "/repos/alice/demo/keys", "--method", "POST", "--json", "--field", "title=empty"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).not.toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("deploy key list empty repo", async () => {
  await withSandbox("jjhub-dk-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/repos/alice/demo/keys",
        response: { json: [] },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["api", "/repos/alice/demo/keys", "--method", "GET", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(parsed).toHaveLength(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
