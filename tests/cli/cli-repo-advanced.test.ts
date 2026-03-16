import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  expectJsonBody,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const REPO_DETAIL = {
  id: 7,
  owner: "alice",
  name: "my-repo",
  full_name: "alice/my-repo",
  description: "A repository",
  is_public: false,
  default_bookmark: "trunk",
  topics: ["jj", "rust"],
  is_archived: false,
  is_fork: false,
  num_stars: 8,
  num_watches: 5,
  num_issues: 3,
  clone_url: "git@jjhub.tech:alice/my-repo.git",
  created_at: "2026-02-19T00:00:00Z",
  updated_at: "2026-02-21T00:00:00Z",
};

test("repo fork sends POST to forks endpoint", async () => {
  await withSandbox("jjhub-repo-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/my-repo/forks",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          const body = JSON.parse(bodyText) as Record<string, unknown>;
          expect(body.name).toBe("my-fork");
        },
        response: {
          status: 201,
          json: { ...REPO_DETAIL, name: "my-fork", full_name: "bob/my-fork", owner: "bob", is_fork: true },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["repo", "fork", "alice/my-repo", "--name", "my-fork"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Forked");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("repo delete sends DELETE request", async () => {
  await withSandbox("jjhub-repo-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/api/repos/alice/my-repo",
        response: { status: 204, body: null },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["repo", "delete", "alice/my-repo", "--json"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.status).toBe("deleted");
      expect(parsed.repo).toBe("alice/my-repo");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("repo view json output returns full detail", async () => {
  await withSandbox("jjhub-repo-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/my-repo",
        response: { json: REPO_DETAIL },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["repo", "view", "--repo=alice/my-repo", "--json"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.full_name).toBe("alice/my-repo");
      expect(parsed.num_stars).toBe(8);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("repo edit patches description and name", async () => {
  await withSandbox("jjhub-repo-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PATCH",
        path: "/api/repos/alice/my-repo",
        assert({ bodyText }) {
          expectJsonBody(bodyText, {
            description: "Updated description",
            name: "renamed-repo",
          });
        },
        response: {
          json: {
            ...REPO_DETAIL,
            description: "Updated description",
            name: "renamed-repo",
            full_name: "alice/renamed-repo",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["repo", "edit", "alice/my-repo", "--description", "Updated description", "--name", "renamed-repo"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Updated");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("repo star sends PUT request", async () => {
  await withSandbox("jjhub-repo-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PUT",
        path: "/api/user/starred/alice/my-repo",
        response: { status: 204, body: null },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["repo", "star", "alice/my-repo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Starred");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("repo archive sends POST to archive endpoint", async () => {
  await withSandbox("jjhub-repo-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/my-repo/archive",
        response: { status: 204, body: null },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["repo", "archive", "alice/my-repo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Archived");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
