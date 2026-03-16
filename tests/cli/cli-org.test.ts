import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  expectJsonBody,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const ORG_RESPONSE = {
  id: 1,
  username: "acme",
  description: "Acme Corp",
  visibility: "public",
  created_at: "2026-02-19T00:00:00Z",
};

test("org create sends name and description", async () => {
  await withSandbox("jjhub-org-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/orgs",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expectJsonBody(bodyText, {
            username: "acme",
            description: "Acme Corp",
            visibility: "public",
          });
        },
        response: { status: 201, json: ORG_RESPONSE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["org", "create", "acme", "--description", "Acme Corp", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.username).toBe("acme");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("org list returns user orgs", async () => {
  await withSandbox("jjhub-org-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/user/orgs",
        response: { json: [ORG_RESPONSE] },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["org", "list", "--json"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.username).toBe("acme");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("org view returns org details", async () => {
  await withSandbox("jjhub-org-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/orgs/acme",
        response: { json: ORG_RESPONSE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["org", "view", "acme", "--json"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.username).toBe("acme");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("org edit patches description", async () => {
  await withSandbox("jjhub-org-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PATCH",
        path: "/api/orgs/acme",
        assert({ bodyText }) {
          expectJsonBody(bodyText, { description: "Updated Acme" });
        },
        response: { json: { ...ORG_RESPONSE, description: "Updated Acme" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["org", "edit", "acme", "--description", "Updated Acme", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.description).toBe("Updated Acme");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("org delete sends DELETE request", async () => {
  await withSandbox("jjhub-org-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/api/orgs/acme",
        response: { status: 204, body: null },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["org", "delete", "acme", "--json"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.status).toBe("deleted");
      expect(parsed.name).toBe("acme");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("org member list returns members", async () => {
  await withSandbox("jjhub-org-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/orgs/acme/members",
        response: {
          json: [
            { id: 1, login: "alice", role: "owner" },
            { id: 2, login: "bob", role: "member" },
          ],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["org", "member", "list", "acme", "--json"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(parsed).toHaveLength(2);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("org member add sends POST request", async () => {
  await withSandbox("jjhub-org-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/orgs/acme/members",
        assert({ bodyText }) {
          expectJsonBody(bodyText, { username: "charlie" });
        },
        response: { status: 201, json: { id: 3, login: "charlie", role: "member" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["org", "member", "add", "acme", "charlie", "--json"], {
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
