import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  expectJsonBody,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const SSH_KEY = {
  id: 5,
  name: "laptop",
  fingerprint: "SHA256:abc123def456",
  key_type: "ssh-ed25519",
  created_at: "2026-02-01T00:00:00Z",
};

const SSH_KEYS = [
  {
    id: 5,
    name: "laptop",
    fingerprint: "SHA256:abc123",
    key_type: "ssh-ed25519",
    created_at: "2026-02-01T00:00:00Z",
  },
  {
    id: 6,
    name: "desktop",
    fingerprint: "SHA256:def456",
    key_type: "ssh-rsa",
    created_at: "2026-02-02T00:00:00Z",
  },
];

test("ssh key list with mock server", async () => {
  await withSandbox("jjhub-ssh-key-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/user/keys",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: { json: SSH_KEYS },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["ssh-key", "list"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("laptop");
      expect(result.stdout).toContain("desktop");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("ssh key list json output", async () => {
  await withSandbox("jjhub-ssh-key-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/user/keys",
        response: { json: SSH_KEYS },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--json", "ssh-key", "list"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]?.name).toBe("laptop");
      expect(parsed[1]?.name).toBe("desktop");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("ssh key list toon output", async () => {
  await withSandbox("jjhub-ssh-key-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/user/keys",
        response: { json: SSH_KEYS },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["--toon", "ssh-key", "list"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.length).toBeGreaterThan(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("ssh key list empty", async () => {
  await withSandbox("jjhub-ssh-key-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/user/keys",
        response: { json: [] },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["ssh-key", "list"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("ssh key add with mock server", async () => {
  await withSandbox("jjhub-ssh-key-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/user/keys",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expectJsonBody(bodyText, {
            title: "laptop",
            key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI test-key",
          });
        },
        response: { status: 201, json: SSH_KEY },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        [
          "ssh-key",
          "add",
          "--title",
          "laptop",
          "--key",
          "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI test-key",
        ],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout.includes("laptop") || result.stdout.includes("Added")).toBe(true);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("ssh key add json output", async () => {
  await withSandbox("jjhub-ssh-key-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/user/keys",
        assert({ bodyText }) {
          expectJsonBody(bodyText, {
            title: "laptop",
            key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI test-key",
          });
        },
        response: { status: 201, json: SSH_KEY },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        [
          "--json",
          "ssh-key",
          "add",
          "--title",
          "laptop",
          "--key",
          "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI test-key",
        ],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.id).toBe(5);
      expect(parsed.name).toBe("laptop");
      expect(parsed.key_type).toBe("ssh-ed25519");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("ssh key add with empty title sends to server", async () => {
  await withSandbox("jjhub-ssh-key-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/user/keys",
        response: {
          status: 422,
          json: { message: "title is required" },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        [
          "ssh-key",
          "add",
          "--title",
          "   ",
          "--key",
          "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI test-key",
        ],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).not.toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("ssh key add with empty key sends to server", async () => {
  await withSandbox("jjhub-ssh-key-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/user/keys",
        response: {
          status: 422,
          json: { message: "key is required" },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["ssh-key", "add", "--title", "laptop", "--key", "   "],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).not.toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("ssh key add handles 422", async () => {
  await withSandbox("jjhub-ssh-key-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/user/keys",
        assert({ bodyText }) {
          expectJsonBody(bodyText, {
            title: "dupe",
            key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI test-key",
          });
        },
        response: {
          status: 422,
          json: {
            message: "validation failed",
            errors: [{ field: "key", message: "key already in use" }],
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        [
          "ssh-key",
          "add",
          "--title",
          "dupe",
          "--key",
          "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI test-key",
        ],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).not.toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("ssh key delete with mock server", async () => {
  await withSandbox("jjhub-ssh-key-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/api/user/keys/5",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: { status: 204 },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["ssh-key", "delete", "5"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.includes("deleted") || result.stdout.includes("5")).toBe(true);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("ssh key delete not found", async () => {
  await withSandbox("jjhub-ssh-key-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/api/user/keys/9999",
        response: { status: 404, json: { message: "key not found" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["ssh-key", "delete", "9999"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).not.toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("ssh key delete rejects zero id", async () => {
  await withSandbox("jjhub-ssh-key-", async (sandbox) => {
    const result = await runCli(["ssh-key", "delete", "0"], {
      cwd: sandbox.root,
      env: sandbox.env(),
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("invalid SSH key id");
  });
});

test("ssh key list without auth fails", async () => {
  await withSandbox("jjhub-ssh-key-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech", "");

    const result = await runCli(["ssh-key", "list"], {
      cwd: sandbox.root,
      env: sandbox.env({
        JJHUB_TEST_CREDENTIAL_STORE_FILE: sandbox.keyringFile,
        JJHUB_TOKEN: undefined,
      }),
    });

    expect(result.exitCode).not.toBe(0);
    expect(
      result.stderr.includes("not authenticated") || result.stderr.includes("auth"),
    ).toBe(true);
  });
});
