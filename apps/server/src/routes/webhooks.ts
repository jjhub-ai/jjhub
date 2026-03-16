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

interface CreateWebhookRequest {
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
}

interface PatchWebhookRequest {
  url?: string;
  secret?: string;
  events?: string[];
  is_active?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEBHOOK_SIGNATURE_HEADER = "X-JJHub-Signature-256";
const MAX_REQUEST_BODY_SIZE = 10 * 1024 * 1024; // 10 MB

function parseWebhookDeliveryPagination(
  query: URLSearchParams,
): { cursor: string; limit: number } {
  const cursor = query.get("cursor") ?? "";
  let limit = 30;
  const l = query.get("limit");
  if (l) {
    const n = parseInt(l, 10);
    if (!isNaN(n) && n > 0) {
      limit = Math.min(n, 30);
    }
  }
  return { cursor, limit };
}

// ---------------------------------------------------------------------------
// Service stub — real implementation will be injected later
// ---------------------------------------------------------------------------

const service = {
  listWebhooks: async (
    _actor: any,
    _owner: string,
    _repo: string,
  ): Promise<any[]> => [],
  getWebhook: async (
    _actor: any,
    _owner: string,
    _repo: string,
    _id: number,
  ): Promise<any> => ({}),
  createWebhook: async (
    _actor: any,
    _owner: string,
    _repo: string,
    _input: any,
  ): Promise<any> => ({}),
  updateWebhook: async (
    _actor: any,
    _owner: string,
    _repo: string,
    _id: number,
    _input: any,
  ): Promise<any> => ({}),
  deleteWebhook: async (
    _actor: any,
    _owner: string,
    _repo: string,
    _id: number,
  ): Promise<void> => {},
  testWebhook: async (
    _actor: any,
    _owner: string,
    _repo: string,
    _id: number,
  ): Promise<void> => {},
  verifyInboundWebhookSignature: async (
    _owner: string,
    _repo: string,
    _id: number,
    _payload: Uint8Array,
    _signature: string,
  ): Promise<void> => {},
  listWebhookDeliveries: async (
    _actor: any,
    _owner: string,
    _repo: string,
    _id: number,
    _page: number,
    _perPage: number,
  ): Promise<any[]> => [],
};

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const app = new Hono();

// GET /api/repos/:owner/:repo/hooks
app.get("/api/repos/:owner/:repo/hooks", async (c) => {
  const actor = getUser(c);
  const { owner, repo } = c.req.param();

  try {
    const hooks = await service.listWebhooks(actor, owner, repo);
    return writeJSON(c, 200, hooks);
  } catch (err) {
    return writeRouteError(c, err);
  }
});

// POST /api/repos/:owner/:repo/hooks
app.post("/api/repos/:owner/:repo/hooks", async (c) => {
  const actor = getUser(c);
  if (!actor) {
    return writeError(c, unauthorized("authentication required"));
  }
  const { owner, repo } = c.req.param();

  let body: CreateWebhookRequest;
  try {
    body = await c.req.json<CreateWebhookRequest>();
  } catch {
    return writeError(c, badRequest("invalid request body"));
  }

  try {
    const created = await service.createWebhook(actor, owner, repo, {
      url: body.url,
      secret: body.secret,
      events: body.events,
      is_active: body.is_active,
    });
    return writeJSON(c, 201, created);
  } catch (err) {
    return writeRouteError(c, err);
  }
});

// GET /api/repos/:owner/:repo/hooks/:id
app.get("/api/repos/:owner/:repo/hooks/:id", async (c) => {
  const actor = getUser(c);
  const { owner, repo, id } = c.req.param();

  const webhookId = parseInt(id, 10);
  if (isNaN(webhookId)) {
    return writeError(c, badRequest("invalid webhook id"));
  }

  try {
    const hook = await service.getWebhook(actor, owner, repo, webhookId);
    return writeJSON(c, 200, hook);
  } catch (err) {
    return writeRouteError(c, err);
  }
});

// PATCH /api/repos/:owner/:repo/hooks/:id
app.patch("/api/repos/:owner/:repo/hooks/:id", async (c) => {
  const actor = getUser(c);
  if (!actor) {
    return writeError(c, unauthorized("authentication required"));
  }
  const { owner, repo, id } = c.req.param();

  const webhookId = parseInt(id, 10);
  if (isNaN(webhookId)) {
    return writeError(c, badRequest("invalid webhook id"));
  }

  let body: PatchWebhookRequest;
  try {
    body = await c.req.json<PatchWebhookRequest>();
  } catch {
    return writeError(c, badRequest("invalid request body"));
  }

  try {
    const updated = await service.updateWebhook(
      actor,
      owner,
      repo,
      webhookId,
      {
        url: body.url,
        secret: body.secret,
        events: body.events,
        is_active: body.is_active,
      },
    );
    return writeJSON(c, 200, updated);
  } catch (err) {
    return writeRouteError(c, err);
  }
});

// DELETE /api/repos/:owner/:repo/hooks/:id
app.delete("/api/repos/:owner/:repo/hooks/:id", async (c) => {
  const actor = getUser(c);
  if (!actor) {
    return writeError(c, unauthorized("authentication required"));
  }
  const { owner, repo, id } = c.req.param();

  const webhookId = parseInt(id, 10);
  if (isNaN(webhookId)) {
    return writeError(c, badRequest("invalid webhook id"));
  }

  try {
    await service.deleteWebhook(actor, owner, repo, webhookId);
    return c.body(null, 204);
  } catch (err) {
    return writeRouteError(c, err);
  }
});

// POST /api/repos/:owner/:repo/hooks/:id/tests
app.post("/api/repos/:owner/:repo/hooks/:id/tests", async (c) => {
  const actor = getUser(c);
  if (!actor) {
    return writeError(c, unauthorized("authentication required"));
  }
  const { owner, repo, id } = c.req.param();

  const webhookId = parseInt(id, 10);
  if (isNaN(webhookId)) {
    return writeError(c, badRequest("invalid webhook id"));
  }

  try {
    await service.testWebhook(actor, owner, repo, webhookId);
    return c.body(null, 204);
  } catch (err) {
    return writeRouteError(c, err);
  }
});

// POST /api/repos/:owner/:repo/hooks/:id/receive (inbound webhook)
app.post("/api/repos/:owner/:repo/hooks/:id/receive", async (c) => {
  const { owner, repo, id } = c.req.param();

  const webhookId = parseInt(id, 10);
  if (isNaN(webhookId)) {
    return writeError(c, badRequest("invalid webhook id"));
  }

  let payload: Uint8Array;
  try {
    const arrayBuf = await c.req.arrayBuffer();
    if (arrayBuf.byteLength > MAX_REQUEST_BODY_SIZE) {
      return writeError(c, badRequest("invalid webhook payload"));
    }
    payload = new Uint8Array(arrayBuf);
  } catch {
    return writeError(c, badRequest("invalid webhook payload"));
  }

  const signature = (c.req.header(WEBHOOK_SIGNATURE_HEADER) ?? "").trim();
  if (!signature) {
    return writeError(c, unauthorized("missing webhook signature"));
  }

  try {
    await service.verifyInboundWebhookSignature(
      owner,
      repo,
      webhookId,
      payload,
      signature,
    );
    return c.body(null, 204);
  } catch (err) {
    return writeRouteError(c, err);
  }
});

// GET /api/repos/:owner/:repo/hooks/:id/deliveries
app.get("/api/repos/:owner/:repo/hooks/:id/deliveries", async (c) => {
  const actor = getUser(c);
  const { owner, repo, id } = c.req.param();

  const webhookId = parseInt(id, 10);
  if (isNaN(webhookId)) {
    return writeError(c, badRequest("invalid webhook id"));
  }

  const query = new URL(c.req.url).searchParams;
  const { cursor, limit } = parseWebhookDeliveryPagination(query);
  // Convert cursor-based pagination to page-based
  const page = cursor ? Math.max(1, Math.ceil(parseInt(cursor, 10) / limit)) : 1;

  try {
    const deliveries = await service.listWebhookDeliveries(
      actor,
      owner,
      repo,
      webhookId,
      page,
      limit,
    );
    return writeJSON(c, 200, deliveries);
  } catch (err) {
    return writeRouteError(c, err);
  }
});

export default app;
