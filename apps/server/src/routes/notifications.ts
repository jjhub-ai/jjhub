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
// Service stub
// ---------------------------------------------------------------------------

const service = {
  listNotifications: async (
    _userId: number,
    _page: number,
    _perPage: number,
  ): Promise<{ items: any[]; total: number }> => ({ items: [], total: 0 }),
  listNotificationsAfterID: async (
    _userId: number,
    _afterId: number,
    _limit: number,
  ): Promise<any[]> => [],
  markRead: async (_userId: number, _notificationId: number): Promise<void> => {},
  markAllRead: async (_userId: number): Promise<void> => {},
};

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

  try {
    const { items, total } = await service.listNotifications(
      user.id,
      page,
      perPage,
    );
    c.header("X-Total-Count", String(total));
    return writeJSON(c, 200, items);
  } catch (err) {
    return writeRouteError(c, err);
  }
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

  try {
    await service.markRead(user.id, notifId);
    return c.body(null, 204);
  } catch (err) {
    return writeRouteError(c, err);
  }
});

// PUT /api/notifications/mark-read
app.put("/api/notifications/mark-read", async (c) => {
  const user = getUser(c);
  if (!user) {
    return writeError(c, unauthorized("authentication required"));
  }

  try {
    await service.markAllRead(user.id);
    return c.body(null, 204);
  } catch (err) {
    return writeRouteError(c, err);
  }
});

export default app;
