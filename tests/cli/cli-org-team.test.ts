import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  expectJsonBody,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const TEAM_RESPONSE = {
  id: 1,
  name: "devs",
  slug: "devs",
  description: "Developers",
  permission: "write",
  organization: { username: "acme" },
};

test("org team create sends name and permission", async () => {
  await withSandbox("jjhub-team-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/orgs/acme/teams",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expectJsonBody(bodyText, {
            name: "devs",
            description: "Developers",
            permission: "write",
          });
        },
        response: { status: 201, json: TEAM_RESPONSE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["org", "team", "create", "acme", "devs", "--description", "Developers", "--permission", "write", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.name).toBe("devs");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("org team list returns teams", async () => {
  await withSandbox("jjhub-team-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/orgs/acme/teams",
        response: { json: [TEAM_RESPONSE] },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["org", "team", "list", "acme", "--json"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.name).toBe("devs");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("org team view returns team details", async () => {
  await withSandbox("jjhub-team-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/orgs/acme/teams/devs",
        response: { json: TEAM_RESPONSE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["org", "team", "view", "acme", "devs", "--json"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.name).toBe("devs");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("org team edit patches description", async () => {
  await withSandbox("jjhub-team-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PATCH",
        path: "/api/orgs/acme/teams/devs",
        assert({ bodyText }) {
          expectJsonBody(bodyText, { description: "Updated" });
        },
        response: { json: { ...TEAM_RESPONSE, description: "Updated" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["org", "team", "edit", "acme", "devs", "--description", "Updated", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("org team delete sends DELETE request", async () => {
  await withSandbox("jjhub-team-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/api/orgs/acme/teams/devs",
        response: { status: 204, body: null },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["org", "team", "delete", "acme", "devs", "--json"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.status).toBe("deleted");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("org team member list returns team members", async () => {
  await withSandbox("jjhub-team-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/orgs/acme/teams/devs/members",
        response: {
          json: [
            { id: 1, login: "alice" },
            { id: 2, login: "bob" },
          ],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["org", "team", "member", "list", "acme", "devs", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(parsed).toHaveLength(2);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("org team member add puts member endpoint", async () => {
  await withSandbox("jjhub-team-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PUT",
        path: "/api/orgs/acme/teams/devs/members/charlie",
        response: { json: { status: "added" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["org", "team", "member", "add", "acme", "devs", "charlie", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
