import { Hono } from "hono";
import type { Context } from "hono";
import {
  type SSEEvent,
  sseResponse,
  sseStreamWithInitial,
} from "@jjhub/sdk";
import { getServices } from "../services";
// NOTE: No WorkspaceService exists in the SDK service registry yet.
// These routes remain stubbed until a workspace service is implemented.

// ---------------------------------------------------------------------------
// Stubbed service types (mirrors Go services layer)
// ---------------------------------------------------------------------------

interface WorkspaceResponse {
  id: string;
  repository_id: number;
  user_id: number;
  name: string;
  status: string;
  is_fork: boolean;
  parent_workspace_id?: string;
  freestyle_vm_id: string;
  persistence: string;
  ssh_host?: string;
  snapshot_id?: string;
  idle_timeout_seconds: number;
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkspaceSessionResponse {
  id: string;
  workspace_id: string;
  repository_id: number;
  user_id: number;
  status: string;
  cols: number;
  rows: number;
  last_activity_at: string;
  idle_timeout_secs: number;
  created_at: string;
  updated_at: string;
}

interface WorkspaceSSHConnectionInfo {
  workspace_id: string;
  session_id: string;
  vm_id: string;
  host: string;
  ssh_host: string;
  username: string;
  port: number;
  access_token: string;
  command: string;
}

interface WorkspaceSnapshotResponse {
  id: string;
  repository_id: number;
  user_id: number;
  name: string;
  workspace_id?: string;
  freestyle_snapshot_id: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Stubbed service calls — to be replaced with real DB/service layer
// ---------------------------------------------------------------------------

const workspaceService = {
  createWorkspace: async (_input: {
    repositoryID: number;
    userID: number;
    repoOwner: string;
    repoName: string;
    name: string;
    snapshotID: string;
  }): Promise<WorkspaceResponse> => {
    throw new ServiceError(501, "workspace service not implemented");
  },
  getWorkspace: async (
    _workspaceID: string,
    _repositoryID: number,
    _userID: number
  ): Promise<WorkspaceResponse | null> => {
    return null;
  },
  listWorkspaces: async (
    _repositoryID: number,
    _userID: number,
    _page: number,
    _perPage: number
  ): Promise<{ workspaces: WorkspaceResponse[]; total: number }> => {
    return { workspaces: [], total: 0 };
  },
  getWorkspaceSSHConnectionInfo: async (
    _workspaceID: string,
    _repositoryID: number,
    _userID: number
  ): Promise<WorkspaceSSHConnectionInfo | null> => {
    return null;
  },
  suspendWorkspace: async (
    _workspaceID: string,
    _repositoryID: number,
    _userID: number
  ): Promise<WorkspaceResponse | null> => {
    return null;
  },
  resumeWorkspace: async (
    _workspaceID: string,
    _repositoryID: number,
    _userID: number
  ): Promise<WorkspaceResponse | null> => {
    return null;
  },
  deleteWorkspace: async (
    _workspaceID: string,
    _repositoryID: number,
    _userID: number
  ): Promise<void> => {},
  forkWorkspace: async (_input: {
    repositoryID: number;
    userID: number;
    workspaceID: string;
    name: string;
  }): Promise<WorkspaceResponse> => {
    throw new ServiceError(501, "workspace service not implemented");
  },
  createWorkspaceSnapshot: async (_input: {
    repositoryID: number;
    userID: number;
    workspaceID: string;
    name: string;
  }): Promise<WorkspaceSnapshotResponse> => {
    throw new ServiceError(501, "workspace service not implemented");
  },
  getWorkspaceSnapshot: async (
    _snapshotID: string,
    _repositoryID: number,
    _userID: number
  ): Promise<WorkspaceSnapshotResponse | null> => {
    return null;
  },
  listWorkspaceSnapshots: async (
    _repositoryID: number,
    _userID: number,
    _page: number,
    _perPage: number
  ): Promise<{ snapshots: WorkspaceSnapshotResponse[]; total: number }> => {
    return { snapshots: [], total: 0 };
  },
  deleteWorkspaceSnapshot: async (
    _snapshotID: string,
    _repositoryID: number,
    _userID: number
  ): Promise<void> => {},
  createSession: async (_input: {
    repositoryID: number;
    userID: number;
    cols: number;
    rows: number;
    repoOwner: string;
    repoName: string;
    workspaceID: string;
  }): Promise<WorkspaceSessionResponse> => {
    throw new ServiceError(501, "workspace service not implemented");
  },
  getSession: async (
    _sessionID: string,
    _repositoryID: number,
    _userID: number
  ): Promise<WorkspaceSessionResponse | null> => {
    return null;
  },
  listSessions: async (
    _repositoryID: number,
    _userID: number,
    _page: number,
    _perPage: number
  ): Promise<{ sessions: WorkspaceSessionResponse[]; total: number }> => {
    return { sessions: [], total: 0 };
  },
  getSSHConnectionInfo: async (
    _sessionID: string,
    _repositoryID: number,
    _userID: number
  ): Promise<WorkspaceSSHConnectionInfo | null> => {
    return null;
  },
  destroySession: async (
    _sessionID: string,
    _repositoryID: number,
    _userID: number
  ): Promise<void> => {},
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class ServiceError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
  }
}

function parsePagination(c: Context): { page: number; limit: number } | { error: string } {
  const rawPage = c.req.query("page");
  const rawPerPage = c.req.query("per_page");
  const rawLimit = c.req.query("limit");
  const rawCursor = c.req.query("cursor");

  let limit = 30;
  let page = 1;

  // Legacy pagination (page + per_page)
  if (rawPage || rawPerPage) {
    if (rawPage) {
      const parsed = parseInt(rawPage, 10);
      if (isNaN(parsed) || parsed <= 0) return { error: "invalid page value" };
      page = parsed;
    }
    if (rawPerPage) {
      const parsed = parseInt(rawPerPage, 10);
      if (isNaN(parsed) || parsed <= 0) return { error: "invalid per_page value" };
      if (parsed > 100) return { error: "per_page must not exceed 100" };
      limit = parsed;
    }
    return { page, limit };
  }

  // Cursor-based pagination
  if (rawLimit) {
    const parsed = parseInt(rawLimit, 10);
    if (isNaN(parsed) || parsed <= 0) return { error: "invalid limit value" };
    limit = Math.min(parsed, 100);
  }
  if (rawCursor) {
    const offset = parseInt(rawCursor, 10);
    if (!isNaN(offset) && offset >= 0 && limit > 0) {
      page = Math.floor(offset / limit) + 1;
    }
  }
  return { page, limit };
}

function routeParam(c: Context, key: string, _message: string): string | null {
  const value = (c.req.param(key) ?? "").trim();
  if (!value) return null;
  return value;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

const app = new Hono();

// ---------------------------------------------------------------------------
// Workspaces CRUD
// ---------------------------------------------------------------------------

// POST /api/repos/:owner/:repo/workspaces — Create workspace
app.post("/api/repos/:owner/:repo/workspaces", async (c) => {
  const repositoryID = 0; // TODO: from repo context middleware
  const userID = 0; // TODO: from auth middleware
  const owner = c.req.param("owner") ?? "";
  const repo = c.req.param("repo") ?? "";

  let body: { name?: string; snapshot_id?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ message: "invalid request body" }, 400);
  }

  try {
    const workspace = await workspaceService.createWorkspace({
      repositoryID,
      userID,
      repoOwner: owner,
      repoName: repo,
      name: body.name ?? "",
      snapshotID: body.snapshot_id ?? "",
    });
    return c.json(workspace, 201);
  } catch (err) {
    if (err instanceof ServiceError) {
      return c.json({ message: err.message }, err.statusCode as any);
    }
    return c.json({ message: "internal server error" }, 500);
  }
});

// GET /api/repos/:owner/:repo/workspaces — List workspaces
app.get("/api/repos/:owner/:repo/workspaces", async (c) => {
  const repositoryID = 0; // TODO: from repo context middleware
  const userID = 0; // TODO: from auth middleware

  const pag = parsePagination(c);
  if ("error" in pag) return c.json({ message: pag.error }, 400);

  const { workspaces, total } = await workspaceService.listWorkspaces(
    repositoryID,
    userID,
    pag.page,
    pag.limit
  );

  c.header("X-Total-Count", String(total));
  return c.json(workspaces, 200);
});

// GET /api/repos/:owner/:repo/workspaces/:id — Get workspace
app.get("/api/repos/:owner/:repo/workspaces/:id", async (c) => {
  const repositoryID = 0; // TODO: from repo context middleware
  const userID = 0; // TODO: from auth middleware

  const workspaceID = routeParam(c, "id", "workspace id is required");
  if (!workspaceID) return c.json({ message: "workspace id is required" }, 400);

  const workspace = await workspaceService.getWorkspace(workspaceID, repositoryID, userID);
  if (!workspace) return c.json({ message: "workspace not found" }, 404);

  return c.json(workspace, 200);
});

// GET /api/repos/:owner/:repo/workspaces/:id/ssh — Get workspace SSH connection info
app.get("/api/repos/:owner/:repo/workspaces/:id/ssh", async (c) => {
  const repositoryID = 0; // TODO: from repo context middleware
  const userID = 0; // TODO: from auth middleware

  const workspaceID = routeParam(c, "id", "workspace id is required");
  if (!workspaceID) return c.json({ message: "workspace id is required" }, 400);

  const info = await workspaceService.getWorkspaceSSHConnectionInfo(
    workspaceID,
    repositoryID,
    userID
  );
  if (!info) return c.json({ message: "workspace not found" }, 404);

  return c.json(info, 200);
});

// POST /api/repos/:owner/:repo/workspaces/:id/suspend — Suspend workspace
app.post("/api/repos/:owner/:repo/workspaces/:id/suspend", async (c) => {
  const repositoryID = 0; // TODO: from repo context middleware
  const userID = 0; // TODO: from auth middleware

  const workspaceID = routeParam(c, "id", "workspace id is required");
  if (!workspaceID) return c.json({ message: "workspace id is required" }, 400);

  const updated = await workspaceService.suspendWorkspace(workspaceID, repositoryID, userID);
  if (!updated) return c.json({ message: "workspace not found" }, 404);

  return c.json(updated, 200);
});

// POST /api/repos/:owner/:repo/workspaces/:id/resume — Resume workspace
app.post("/api/repos/:owner/:repo/workspaces/:id/resume", async (c) => {
  const repositoryID = 0; // TODO: from repo context middleware
  const userID = 0; // TODO: from auth middleware

  const workspaceID = routeParam(c, "id", "workspace id is required");
  if (!workspaceID) return c.json({ message: "workspace id is required" }, 400);

  const updated = await workspaceService.resumeWorkspace(workspaceID, repositoryID, userID);
  if (!updated) return c.json({ message: "workspace not found" }, 404);

  return c.json(updated, 200);
});

// DELETE /api/repos/:owner/:repo/workspaces/:id — Delete workspace
app.delete("/api/repos/:owner/:repo/workspaces/:id", async (c) => {
  const repositoryID = 0; // TODO: from repo context middleware
  const userID = 0; // TODO: from auth middleware

  const workspaceID = routeParam(c, "id", "workspace id is required");
  if (!workspaceID) return c.json({ message: "workspace id is required" }, 400);

  await workspaceService.deleteWorkspace(workspaceID, repositoryID, userID);
  return c.body(null, 204);
});

// POST /api/repos/:owner/:repo/workspaces/:id/fork — Fork workspace
app.post("/api/repos/:owner/:repo/workspaces/:id/fork", async (c) => {
  const repositoryID = 0; // TODO: from repo context middleware
  const userID = 0; // TODO: from auth middleware

  const workspaceID = routeParam(c, "id", "workspace id is required");
  if (!workspaceID) return c.json({ message: "workspace id is required" }, 400);

  let body: { name?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ message: "invalid request body" }, 400);
  }

  try {
    const forked = await workspaceService.forkWorkspace({
      repositoryID,
      userID,
      workspaceID,
      name: body.name ?? "",
    });
    return c.json(forked, 201);
  } catch (err) {
    if (err instanceof ServiceError) {
      return c.json({ message: err.message }, err.statusCode as any);
    }
    return c.json({ message: "internal server error" }, 500);
  }
});

// POST /api/repos/:owner/:repo/workspaces/:id/snapshot — Create snapshot from workspace
app.post("/api/repos/:owner/:repo/workspaces/:id/snapshot", async (c) => {
  const repositoryID = 0; // TODO: from repo context middleware
  const userID = 0; // TODO: from auth middleware

  const workspaceID = routeParam(c, "id", "workspace id is required");
  if (!workspaceID) return c.json({ message: "workspace id is required" }, 400);

  let body: { name?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ message: "invalid request body" }, 400);
  }

  try {
    const snapshot = await workspaceService.createWorkspaceSnapshot({
      repositoryID,
      userID,
      workspaceID,
      name: body.name ?? "",
    });
    return c.json(snapshot, 201);
  } catch (err) {
    if (err instanceof ServiceError) {
      return c.json({ message: err.message }, err.statusCode as any);
    }
    return c.json({ message: "internal server error" }, 500);
  }
});

// ---------------------------------------------------------------------------
// Workspace snapshots (top-level)
// ---------------------------------------------------------------------------

// POST /api/repos/:owner/:repo/workspace-snapshots — Create snapshot (template endpoint)
app.post("/api/repos/:owner/:repo/workspace-snapshots", async (c) => {
  const repositoryID = 0; // TODO: from repo context middleware
  const userID = 0; // TODO: from auth middleware

  let body: { workspace_id?: string; name?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ message: "invalid request body" }, 400);
  }

  const workspaceID = (body.workspace_id ?? "").trim();
  if (!workspaceID) return c.json({ message: "workspace_id is required" }, 400);

  try {
    const snapshot = await workspaceService.createWorkspaceSnapshot({
      repositoryID,
      userID,
      workspaceID,
      name: body.name ?? "",
    });
    return c.json(snapshot, 201);
  } catch (err) {
    if (err instanceof ServiceError) {
      return c.json({ message: err.message }, err.statusCode as any);
    }
    return c.json({ message: "internal server error" }, 500);
  }
});

// GET /api/repos/:owner/:repo/workspace-snapshots/:id — Get snapshot
app.get("/api/repos/:owner/:repo/workspace-snapshots/:id", async (c) => {
  const repositoryID = 0; // TODO: from repo context middleware
  const userID = 0; // TODO: from auth middleware

  const snapshotID = routeParam(c, "id", "workspace snapshot id is required");
  if (!snapshotID) return c.json({ message: "workspace snapshot id is required" }, 400);

  const snapshot = await workspaceService.getWorkspaceSnapshot(snapshotID, repositoryID, userID);
  if (!snapshot) return c.json({ message: "workspace snapshot not found" }, 404);

  return c.json(snapshot, 200);
});

// GET /api/repos/:owner/:repo/workspace-snapshots — List snapshots
app.get("/api/repos/:owner/:repo/workspace-snapshots", async (c) => {
  const repositoryID = 0; // TODO: from repo context middleware
  const userID = 0; // TODO: from auth middleware

  const pag = parsePagination(c);
  if ("error" in pag) return c.json({ message: pag.error }, 400);

  const { snapshots, total } = await workspaceService.listWorkspaceSnapshots(
    repositoryID,
    userID,
    pag.page,
    pag.limit
  );

  c.header("X-Total-Count", String(total));
  return c.json(snapshots, 200);
});

// DELETE /api/repos/:owner/:repo/workspace-snapshots/:id — Delete snapshot
app.delete("/api/repos/:owner/:repo/workspace-snapshots/:id", async (c) => {
  const repositoryID = 0; // TODO: from repo context middleware
  const userID = 0; // TODO: from auth middleware

  const snapshotID = routeParam(c, "id", "workspace snapshot id is required");
  if (!snapshotID) return c.json({ message: "workspace snapshot id is required" }, 400);

  await workspaceService.deleteWorkspaceSnapshot(snapshotID, repositoryID, userID);
  return c.body(null, 204);
});

// ---------------------------------------------------------------------------
// Workspace sessions
// ---------------------------------------------------------------------------

// POST /api/repos/:owner/:repo/workspace/sessions — Create session
app.post("/api/repos/:owner/:repo/workspace/sessions", async (c) => {
  const repositoryID = 0; // TODO: from repo context middleware
  const userID = 0; // TODO: from auth middleware
  const owner = c.req.param("owner") ?? "";
  const repo = c.req.param("repo") ?? "";

  let body: { cols?: number; rows?: number; workspace_id?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ message: "invalid request body" }, 400);
  }

  try {
    const session = await workspaceService.createSession({
      repositoryID,
      userID,
      cols: body.cols ?? 0,
      rows: body.rows ?? 0,
      repoOwner: owner,
      repoName: repo,
      workspaceID: body.workspace_id ?? "",
    });
    return c.json(session, 201);
  } catch (err) {
    if (err instanceof ServiceError) {
      return c.json({ message: err.message }, err.statusCode as any);
    }
    return c.json({ message: "internal server error" }, 500);
  }
});

// GET /api/repos/:owner/:repo/workspace/sessions/:id — Get session
app.get("/api/repos/:owner/:repo/workspace/sessions/:id", async (c) => {
  const repositoryID = 0; // TODO: from repo context middleware
  const userID = 0; // TODO: from auth middleware

  const sessionID = routeParam(c, "id", "session id is required");
  if (!sessionID) return c.json({ message: "session id is required" }, 400);

  const session = await workspaceService.getSession(sessionID, repositoryID, userID);
  if (!session) return c.json({ message: "workspace session not found" }, 404);

  return c.json(session, 200);
});

// GET /api/repos/:owner/:repo/workspace/sessions — List sessions
app.get("/api/repos/:owner/:repo/workspace/sessions", async (c) => {
  const repositoryID = 0; // TODO: from repo context middleware
  const userID = 0; // TODO: from auth middleware

  const pag = parsePagination(c);
  if ("error" in pag) return c.json({ message: pag.error }, 400);

  const { sessions, total } = await workspaceService.listSessions(
    repositoryID,
    userID,
    pag.page,
    pag.limit
  );

  c.header("X-Total-Count", String(total));
  return c.json(sessions, 200);
});

// GET /api/repos/:owner/:repo/workspace/sessions/:id/ssh — Get session SSH connection info
app.get("/api/repos/:owner/:repo/workspace/sessions/:id/ssh", async (c) => {
  const repositoryID = 0; // TODO: from repo context middleware
  const userID = 0; // TODO: from auth middleware

  const sessionID = routeParam(c, "id", "session id is required");
  if (!sessionID) return c.json({ message: "session id is required" }, 400);

  const info = await workspaceService.getSSHConnectionInfo(sessionID, repositoryID, userID);
  if (!info) return c.json({ message: "workspace session not found" }, 404);

  return c.json(info, 200);
});

// POST /api/repos/:owner/:repo/workspace/sessions/:id/destroy — Destroy session
app.post("/api/repos/:owner/:repo/workspace/sessions/:id/destroy", async (c) => {
  const repositoryID = 0; // TODO: from repo context middleware
  const userID = 0; // TODO: from auth middleware

  const sessionID = routeParam(c, "id", "session id is required");
  if (!sessionID) return c.json({ message: "session id is required" }, 400);

  await workspaceService.destroySession(sessionID, repositoryID, userID);
  return c.body(null, 204);
});

// ---------------------------------------------------------------------------
// Workspace SSE streams
// ---------------------------------------------------------------------------

// GET /api/repos/:owner/:repo/workspaces/:id/stream — SSE workspace status stream
// Streams workspace state changes via PostgreSQL LISTEN/NOTIFY.
// Channel: workspace_status_{workspaceId} (dashes removed from UUID)
app.get("/api/repos/:owner/:repo/workspaces/:id/stream", async (c) => {
  const repositoryID = 0; // TODO: from repo context middleware
  const userID = 0; // TODO: from auth middleware

  const workspaceID = routeParam(c, "id", "workspace id is required");
  if (!workspaceID) return c.json({ message: "workspace id is required" }, 400);

  const workspace = await workspaceService.getWorkspace(workspaceID, repositoryID, userID);
  if (!workspace) return c.json({ message: "workspace not found" }, 404);

  const sse = getServices().sse;

  // PG channel uses UUID without dashes (matches sqlc query: replace($1, '-', ''))
  const channelId = workspaceID.replace(/-/g, "");
  const channel = `workspace_status_${channelId}`;

  // Build initial status event
  const initialEvents: SSEEvent[] = [
    {
      id: "1",
      type: "workspace.status",
      data: JSON.stringify({
        workspace_id: workspace.id,
        status: workspace.status,
      }),
    },
  ];

  // Subscribe to live workspace status updates
  const liveStream = sse.subscribe(channel, {
    eventType: "workspace.status",
  });

  const stream = sseStreamWithInitial(initialEvents, liveStream);
  return sseResponse(stream);
});

// GET /api/repos/:owner/:repo/workspace/sessions/:id/stream — SSE session status stream
// Streams session state changes via PostgreSQL LISTEN/NOTIFY.
// Channel: workspace_status_{sessionId} (dashes removed from UUID)
app.get("/api/repos/:owner/:repo/workspace/sessions/:id/stream", async (c) => {
  const repositoryID = 0; // TODO: from repo context middleware
  const userID = 0; // TODO: from auth middleware

  const sessionID = routeParam(c, "id", "session id is required");
  if (!sessionID) return c.json({ message: "session id is required" }, 400);

  const session = await workspaceService.getSession(sessionID, repositoryID, userID);
  if (!session) return c.json({ message: "workspace session not found" }, 404);

  const sse = getServices().sse;

  // PG channel uses UUID without dashes (matches sqlc query)
  const channelId = sessionID.replace(/-/g, "");
  const channel = `workspace_status_${channelId}`;

  // Build initial status event
  const initialEvents: SSEEvent[] = [
    {
      id: "1",
      type: "workspace.session",
      data: JSON.stringify({
        session_id: session.id,
        status: session.status,
      }),
    },
  ];

  // Subscribe to live session status updates
  const liveStream = sse.subscribe(channel, {
    eventType: "workspace.session",
  });

  const stream = sseStreamWithInitial(initialEvents, liveStream);
  return sseResponse(stream);
});

export default app;
