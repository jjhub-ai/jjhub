import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  expectJsonBody,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

const LABEL_RESPONSE = {
  id: 1,
  name: "bug",
  color: "d73a4a",
  description: "Something isn't working",
};

test("label create sends name and color", async () => {
  await withSandbox("jjhub-label-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/labels",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expectJsonBody(bodyText, {
            name: "bug",
            color: "d73a4a",
            description: "Something isn't working",
          });
        },
        response: { status: 201, json: LABEL_RESPONSE },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        [
          "--json",
          "label", "create", "bug",
          "--color", "d73a4a",
          "--description", "Something isn't working",
          "-R", "alice/demo",
        ],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.name).toBe("bug");
      expect(parsed.color).toBe("d73a4a");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("label list returns labels", async () => {
  await withSandbox("jjhub-label-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/labels",
        response: {
          json: [
            LABEL_RESPONSE,
            { id: 2, name: "enhancement", color: "a2eeef", description: "New feature" },
          ],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["label", "list", "--repo", "alice/demo", "--json"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      expect(parsed).toHaveLength(2);
      expect(parsed[0]?.name).toBe("bug");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("label delete sends DELETE request", async () => {
  await withSandbox("jjhub-label-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "DELETE",
        path: "/api/repos/alice/demo/labels/1",
        response: { status: 204, body: null },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["label", "delete", "1", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.status).toBe("deleted");
      expect(parsed.id).toBe(1);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("label create with empty color defaults", async () => {
  await withSandbox("jjhub-label-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/labels",
        assert({ bodyText }) {
          expectJsonBody(bodyText, { name: "docs", color: "" });
        },
        response: { status: 201, json: { id: 3, name: "docs", color: "", description: "" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["label", "create", "docs", "--repo", "alice/demo", "--json"],
        { cwd: sandbox.root, env: sandbox.env() },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.name).toBe("docs");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("label list api error surfaces message", async () => {
  await withSandbox("jjhub-label-adv-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/labels",
        response: { status: 404, json: { message: "repository not found" } },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["label", "list", "--repo", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("not found");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
