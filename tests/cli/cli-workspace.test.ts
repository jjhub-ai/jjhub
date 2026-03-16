import { expect, test } from "bun:test";
import {
  createMockServer,
  expectHeader,
  expectJsonBody,
  runCli,
  withSandbox,
  writeConfig,
} from "./helpers";

test("workspace list uses public endpoint", async () => {
  await withSandbox("jjhub-workspace-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: {
          json: [
            {
              id: "ws_123",
              repository_id: 1,
              user_id: 1,
              name: "primary",
              status: "running",
              is_fork: false,
              freestyle_vm_id: "vm_123",
              persistence: "sticky",
              idle_timeout_seconds: 1800,
              created_at: "2026-03-07T00:00:00Z",
              updated_at: "2026-03-07T00:00:00Z",
            },
          ],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(["workspace", "list", "-R", "alice/demo"], {
        cwd: sandbox.root,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("ws_123");
      expect(result.stdout).toContain("primary");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workspace create posts snapshot id", async () => {
  await withSandbox("jjhub-workspace-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/workspaces",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expectJsonBody(bodyText, {
            name: "restored",
            snapshot_id: "snap_public_123",
          });
        },
        response: {
          status: 201,
          json: {
            id: "ws_restored",
            repository_id: 1,
            user_id: 1,
            name: "restored",
            status: "running",
            is_fork: true,
            freestyle_vm_id: "vm_restored",
            persistence: "sticky",
            snapshot_id: "snap_public_123",
            idle_timeout_seconds: 1800,
            created_at: "2026-03-07T00:00:00Z",
            updated_at: "2026-03-07T00:00:00Z",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        [
          "--json",
          "workspace",
          "create",
          "-R",
          "alice/demo",
          "--name",
          "restored",
          "--snapshot",
          "snap_public_123",
        ],
        {
          cwd: sandbox.root,
          env: sandbox.env(),
        },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.id).toBe("ws_restored");
      expect(parsed.snapshot_id).toBe("snap_public_123");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workspace view returns workspace details with ssh info", async () => {
  await withSandbox("jjhub-workspace-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_123",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: {
          json: {
            id: "ws_123",
            status: "running",
            name: "primary",
            ssh_host: "vm_123+developer@vm-ssh.jjhub.tech",
            persistence: "sticky",
            idle_timeout_seconds: 1800,
            created_at: "2026-03-07T00:00:00Z",
            updated_at: "2026-03-07T00:00:00Z",
          },
        },
      },
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_123/ssh",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: {
          json: {
            workspace_id: "ws_123",
            vm_id: "vm_123",
            host: "vm-ssh.jjhub.tech",
            ssh_host: "vm_123+developer@vm-ssh.jjhub.tech",
            username: "developer",
            port: 22,
            access_token: "ssh-token",
            command: "ssh vm_123+developer:ssh-token@vm-ssh.jjhub.tech",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        [
          "--json",
          "workspace",
          "view",
          "-R",
          "alice/demo",
          "ws_123",
        ],
        {
          cwd: sandbox.root,
          env: sandbox.env(),
        },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.id).toBe("ws_123");
      expect(parsed.ssh).toBeDefined();
      const ssh = parsed.ssh as Record<string, unknown>;
      expect(ssh.command).toContain("vm_123+developer:ssh-token@vm-ssh.jjhub.tech");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workspace create with default name", async () => {
  await withSandbox("jjhub-workspace-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/workspaces",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expectJsonBody(bodyText, { name: "" });
        },
        response: {
          status: 201,
          json: {
            id: "ws_fresh",
            repository_id: 1,
            user_id: 1,
            name: "",
            status: "running",
            is_fork: false,
            freestyle_vm_id: "vm_fresh",
            persistence: "sticky",
            idle_timeout_seconds: 1800,
            created_at: "2026-03-07T00:00:00Z",
            updated_at: "2026-03-07T00:00:00Z",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        [
          "--json",
          "workspace",
          "create",
          "-R",
          "alice/demo",
        ],
        {
          cwd: sandbox.root,
          env: sandbox.env(),
        },
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed.id).toBe("ws_fresh");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workspace fork posts name to public endpoint", async () => {
  await withSandbox("jjhub-workspace-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "POST",
        path: "/api/repos/alice/demo/workspaces/ws_source/fork",
        assert({ bodyText, request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
          expectJsonBody(bodyText, { name: "parallel-branch" });
        },
        response: {
          status: 201,
          json: {
            id: "ws_fork",
            repository_id: 1,
            user_id: 1,
            name: "parallel-branch",
            status: "running",
            is_fork: true,
            parent_workspace_id: "ws_source",
            freestyle_vm_id: "vm_fork",
            persistence: "sticky",
            idle_timeout_seconds: 1800,
            created_at: "2026-03-07T00:00:00Z",
            updated_at: "2026-03-07T00:00:00Z",
          },
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        [
          "workspace",
          "fork",
          "-R",
          "alice/demo",
          "ws_source",
          "--name",
          "parallel-branch",
        ],
        {
          cwd: sandbox.root,
          env: sandbox.env(),
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("ws_fork");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});

test("workspace snapshots lists snapshots for a workspace", async () => {
  await withSandbox("jjhub-workspace-", async (sandbox) => {
    const server = createMockServer([
      {
        method: "GET",
        path: "/api/repos/alice/demo/workspaces/ws_123/snapshots",
        assert({ request }) {
          expectHeader(request, "authorization", "token jjhub_testtoken");
        },
        response: {
          json: [
            {
              id: "snap_123",
              repository_id: 1,
              user_id: 1,
              name: "restore-point",
              workspace_id: "ws_123",
              freestyle_snapshot_id: "fs_snap_123",
              created_at: "2026-03-07T00:00:00Z",
              updated_at: "2026-03-07T00:00:00Z",
            },
          ],
        },
      },
    ]);

    try {
      writeConfig(sandbox.cfgHome, `${server.url}/api`);
      const result = await runCli(
        ["workspace", "snapshots", "-R", "alice/demo", "ws_123"],
        {
          cwd: sandbox.root,
          env: sandbox.env(),
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("snap_123");
      server.assertSatisfied();
    } finally {
      server.stop();
    }
  });
});
