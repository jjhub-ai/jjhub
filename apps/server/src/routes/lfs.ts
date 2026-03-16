import { Hono } from "hono";
import {
  getUser,
  badRequest,
  unauthorized,
  writeError,
  writeJSON,
  writeRouteError,
} from "@jjhub/sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LFSBatchRequest {
  operation: string;
  objects: Array<{ oid: string; size: number }>;
}

interface LFSConfirmRequest {
  oid: string;
  size: number;
}

// ---------------------------------------------------------------------------
// Service stub
// ---------------------------------------------------------------------------

const service = {
  batch: async (
    _actor: any,
    _owner: string,
    _repo: string,
    _input: any,
  ): Promise<any[]> => [],
  confirmUpload: async (
    _actor: any,
    _owner: string,
    _repo: string,
    _input: any,
  ): Promise<any> => ({}),
  deleteObject: async (
    _actor: any,
    _owner: string,
    _repo: string,
    _oid: string,
  ): Promise<void> => {},
  listObjects: async (
    _viewer: any,
    _owner: string,
    _repo: string,
    _page: number,
    _perPage: number,
  ): Promise<{ items: any[]; total: number }> => ({ items: [], total: 0 }),
};

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const app = new Hono();

// GET /api/repos/:owner/:repo/lfs/objects
app.get("/api/repos/:owner/:repo/lfs/objects", async (c) => {
  const viewer = getUser(c);
  const { owner, repo } = c.req.param();

  const query = new URL(c.req.url).searchParams;
  const page = parseInt(query.get("page") ?? "1", 10);
  const perPage = Math.min(parseInt(query.get("per_page") ?? "30", 10), 50);

  try {
    const { items, total } = await service.listObjects(
      viewer,
      owner,
      repo,
      page,
      perPage,
    );
    c.header("X-Total-Count", String(total));
    return writeJSON(c, 200, items);
  } catch (err) {
    return writeRouteError(c, err);
  }
});

// POST /api/repos/:owner/:repo/lfs/batch
app.post("/api/repos/:owner/:repo/lfs/batch", async (c) => {
  const actor = getUser(c);
  const { owner, repo } = c.req.param();

  let body: LFSBatchRequest;
  try {
    body = await c.req.json<LFSBatchRequest>();
  } catch {
    return writeError(c, badRequest("invalid request body"));
  }

  try {
    const rows = await service.batch(actor, owner, repo, {
      operation: body.operation,
      objects: body.objects,
    });
    return writeJSON(c, 200, rows);
  } catch (err) {
    return writeRouteError(c, err);
  }
});

// POST /api/repos/:owner/:repo/lfs/confirm
app.post("/api/repos/:owner/:repo/lfs/confirm", async (c) => {
  const actor = getUser(c);
  if (!actor) {
    return writeError(c, unauthorized("authentication required"));
  }
  const { owner, repo } = c.req.param();

  let body: LFSConfirmRequest;
  try {
    body = await c.req.json<LFSConfirmRequest>();
  } catch {
    return writeError(c, badRequest("invalid request body"));
  }

  try {
    const obj = await service.confirmUpload(actor, owner, repo, {
      oid: body.oid,
      size: body.size,
    });
    return writeJSON(c, 201, obj);
  } catch (err) {
    return writeRouteError(c, err);
  }
});

// DELETE /api/repos/:owner/:repo/lfs/objects/:oid
app.delete("/api/repos/:owner/:repo/lfs/objects/:oid", async (c) => {
  const actor = getUser(c);
  if (!actor) {
    return writeError(c, unauthorized("authentication required"));
  }
  const { owner, repo, oid } = c.req.param();

  if (!oid.trim()) {
    return writeError(c, badRequest("oid is required"));
  }

  try {
    await service.deleteObject(actor, owner, repo, oid);
    return c.body(null, 204);
  } catch (err) {
    return writeRouteError(c, err);
  }
});

export default app;
