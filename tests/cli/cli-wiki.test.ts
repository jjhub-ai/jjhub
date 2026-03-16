import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

test("wiki list sends repo-scoped search params", async () => {
  await withSandbox("jjhub-wiki-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/wiki",
        assert({ query, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expect(query.get("page")).toBe("2");
          expect(query.get("per_page")).toBe("15");
          expect(query.get("q")).toBe("guide");
        },
        response: {
          status: 200,
          json: [
            {
              title: "Guide",
              slug: "guide",
              author: { login: "alice" },
              updated_at: "2025-03-14T00:00:00Z",
            },
          ],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url);
      const result = await runCli(
        ["wiki", "list", "--query", "guide", "--page", "2", "--limit", "15", "-R", "alice/demo"],
        {
          cwd: sandbox.root,
          env: sandbox.env(),
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Guide");
      expect(result.stdout).toContain("guide");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("wiki view prints the page body", async () => {
  await withSandbox("jjhub-wiki-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/wiki/home",
        response: {
          status: 200,
          json: {
            title: "Home",
            slug: "home",
            body: "# Welcome",
            author: { login: "alice" },
            updated_at: "2025-03-14T00:00:00Z",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url);
      const result = await runCli(
        ["wiki", "view", "home", "-R", "alice/demo"],
        {
          cwd: sandbox.root,
          env: sandbox.env(),
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Home");
      expect(result.stdout).toContain("# Welcome");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("wiki create sends title slug and body fields", async () => {
  await withSandbox("jjhub-wiki-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/wiki",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expect(JSON.parse(bodyText)).toEqual({
            title: "Home",
            slug: "home",
            body: "# Welcome",
          });
        },
        response: {
          status: 201,
          json: {
            title: "Home",
            slug: "home",
            body: "# Welcome",
            author: { login: "alice" },
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url);
      const result = await runCli(
        ["wiki", "create", "--title", "Home", "--slug", "home", "--body", "# Welcome", "-R", "alice/demo"],
        {
          cwd: sandbox.root,
          env: sandbox.env(),
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Created wiki page Home");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("wiki edit sends title slug and body patch fields", async () => {
  await withSandbox("jjhub-wiki-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "PATCH",
        path: "/api/repos/alice/demo/wiki/home",
        assert({ bodyText }) {
          expect(JSON.parse(bodyText)).toEqual({
            title: "Start Here",
            slug: "start-here",
            body: "Updated content",
          });
        },
        response: {
          status: 200,
          json: {
            title: "Start Here",
            slug: "start-here",
            body: "Updated content",
            author: { login: "alice" },
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, server.url);
      const result = await runCli(
        ["wiki", "edit", "home", "--title", "Start Here", "--slug", "start-here", "--body", "Updated content", "-R", "alice/demo"],
        {
          cwd: sandbox.root,
          env: sandbox.env(),
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Updated wiki page Start Here");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
