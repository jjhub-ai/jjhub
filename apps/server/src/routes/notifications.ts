import { Hono } from "hono";
import {
  getUser,
  badRequest,
  unauthorized,
  writeError,
  writeJSON,
  writeRouteError,
} from "@jjhub/sdk";
import { Result } from "better-result";
import { getServices } from "../services";

/** Lazily resolve the notification service from the registry on each request. */
function service() {
  return getServices().notification;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const app = new Hono();

// GET /api/notifications (SSE endpoint placeholder)
// In Go, this is the NotificationStream handler that uses PostgreSQL LISTEN/NOTIFY.
// Community Edition returns a 501 for now as it requires a persistent DB connection.
app.get("/api/notifications", async (c) => {
  const user = getUser(c);
  if (!user) {
    return writeError(c, unauthorized("authentication required"));
  }

  // SSE streaming requires a real PostgreSQL LISTEN/NOTIFY connection.
  // The Go implementation:
  // 1. Parses Last-Event-ID header for reconnection replay
  // 2. Opens a dedicated PG connection for LISTEN on user_notifications_{userId}
  // 3. Sets SSE headers (Content-Type: text/event-stream, Cache-Control: no-cache)
  // 4. Replays missed notifications if Last-Event-ID is present
  // 5. Enters a live loop sending events + 15s keep-alive pings
  //
  // For Community Edition, this is a placeholder. Real SSE would need:
  // - A connection pool / dedicated connection for LISTEN
  // - Streaming response support
  return writeJSON(c, 501, {
    message: "SSE streaming not implemented in Community Edition",
  });
});

// GET /api/notifications/list
app.get("/api/notifications/list", async (c) => {
  const user = getUser(c);
  if (!user) {
    return writeError(c, unauthorized("authentication required"));
  }

  const query = new URL(c.req.url).searchParams;
  const page = parseInt(query.get("page") ?? "1", 10);
  const perPage = Math.min(parseInt(query.get("per_page") ?? "30", 10), 50);

  const result = await service().listNotifications(user.id, page, perPage);
  if (Result.isError(result)) {
    return writeRouteError(c, result.error);
  }
  c.header("X-Total-Count", String(result.value.total));
  return writeJSON(c, 200, result.value.items);
});

// PATCH /api/notifications/:id
app.patch("/api/notifications/:id", async (c) => {
  const user = getUser(c);
  if (!user) {
    return writeError(c, unauthorized("authentication required"));
  }

  const { id } = c.req.param();
  const notifId = parseInt(id, 10);
  if (isNaN(notifId) || notifId <= 0) {
    return writeError(c, badRequest("invalid notification id"));
  }

  const result = await service().markRead(user.id, notifId);
  if (Result.isError(result)) {
    return writeRouteError(c, result.error);
  }
  return c.body(null, 204);
});

// PUT /api/notifications/mark-read
app.put("/api/notifications/mark-read", async (c) => {
  const user = getUser(c);
  if (!user) {
    return writeError(c, unauthorized("authentication required"));
  }

  const result = await service().markAllRead(user.id);
  if (Result.isError(result)) {
    return writeRouteError(c, result.error);
  }
  return c.body(null, 204);
});

export default app;
