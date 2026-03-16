import { expect, test } from "bun:test";
import { createMockServer, expectJsonBody, runCli, withSandbox, writeConfig } from "./helpers";

test("extension linear install reads credentials from stdin", async () => {
  await withSandbox("jjhub-extension-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/integrations/linear",
        assert({ bodyText }) {
          expectJsonBody(bodyText, {
            linear_team_id: "team_123",
            linear_team_name: "Platform",
            linear_team_key: "PLT",
            repo_owner: "alice",
            repo_name: "demo",
            repo_id: 42,
            access_token: "linear-access-token",
            refresh_token: "linear-refresh-token",
            expires_at: "2026-03-12T00:00:00Z",
            linear_actor_id: "linear-user-123",
          });
        },
        response: {
          json: {
            id: 7,
            linear_team_id: "team_123",
            linear_team_name: "Platform",
            repo_owner: "alice",
            repo_name: "demo",
            is_active: true,
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        [
          "extension",
          "linear",
          "install",
          "--team-id",
          "team_123",
          "--team-name",
          "Platform",
          "--team-key",
          "PLT",
          "--repo-owner",
          "alice",
          "--repo-name",
          "demo",
          "--repo-id",
          "42",
          "--credentials-stdin",
          "--expires-at",
          "2026-03-12T00:00:00Z",
          "--actor-id",
          "linear-user-123",
        ],
        {
          cwd: sandbox.root,
          env: sandbox.env(),
          stdin: JSON.stringify({
            access_token: "linear-access-token",
            refresh_token: "linear-refresh-token",
          }),
        },
      );

      expect(result.exitCode).toBe(0);
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("extension linear install rejects insecure credential flags", async () => {
  await withSandbox("jjhub-extension-", async (sandbox) => {
    writeConfig(sandbox.cfgHome, "https://api.jjhub.tech");

    const result = await runCli(
      [
        "extension",
        "linear",
        "install",
        "--team-id",
        "team_123",
        "--repo-owner",
        "alice",
        "--repo-name",
        "demo",
        "--repo-id",
        "42",
        "--access-token",
        "linear-access-token",
      ],
      { cwd: sandbox.root, env: sandbox.env() },
    );

    expect(result.exitCode).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("access-token");
  });
});
