import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  expectJsonBody,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const WIKI_PAGE = {
  title: "Home",
  slug: "home",
  body: "# Welcome to the wiki",
  author: { login: "alice" },
  updated_at: "2026-02-19T00:00:00Z",
};

test("wiki create json output", async () => {
  await withSandbox("jjhub-wiki-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/wiki",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expectJsonBody(bodyText, {
            title: "Getting Started",
            body: "## Setup",
          });
        },
        response: {
          status: 201,
          json: { ...WIKI_PAGE, title: "Getting Started", slug: "getting-started", body: "## Setup" },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url);
      const result = await runCli(
        ["wiki", "create", "--title", "Getting Started", "--body", "## Setup", "-R", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.title).toBe("Getting Started");
      expect(parsed.slug).toBe("getting-started");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("wiki list json output", async () => {
  await withSandbox("jjhub-wiki-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/wiki",
        response: { json: [WIKI_PAGE, { ...WIKI_PAGE, title: "FAQ", slug: "faq" }] },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url);
      const result = await runCli(
        ["wiki", "list", "-R", "alice/demo", "--json"],
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

test("wiki view json output", async () => {
  await withSandbox("jjhub-wiki-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/wiki/home",
        response: { json: WIKI_PAGE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url);
      const result = await runCli(
        ["wiki", "view", "home", "-R", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.title).toBe("Home");
      expect(parsed.body).toBe("# Welcome to the wiki");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("wiki edit json output", async () => {
  await withSandbox("jjhub-wiki-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PATCH",
        path: "/api/repos/alice/demo/wiki/home",
        assert({ bodyText }) {
          expectJsonBody(bodyText, { body: "Updated content" });
        },
        response: { json: { ...WIKI_PAGE, body: "Updated content" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url);
      const result = await runCli(
        ["wiki", "edit", "home", "--body", "Updated content", "-R", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.body).toBe("Updated content");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("wiki delete sends DELETE and returns message", async () => {
  await withSandbox("jjhub-wiki-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/api/repos/alice/demo/wiki/home",
        response: { status: 204, body: null },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url);
      const result = await runCli(
        ["wiki", "delete", "home", "-R", "alice/demo"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Deleted wiki page home");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("wiki view not found returns error", async () => {
  await withSandbox("jjhub-wiki-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/wiki/nonexistent",
        response: { status: 404, json: { message: "wiki page not found" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url);
      const result = await runCli(
        ["wiki", "view", "nonexistent", "-R", "alice/demo"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("not found");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
