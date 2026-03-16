-- name: CreateWebhook :one
INSERT INTO webhooks (repository_id, url, secret, events, is_active)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetWebhookByID :one
SELECT * FROM webhooks WHERE id = $1;

-- name: ListWebhooksByIDs :many
SELECT *
FROM webhooks
WHERE id = ANY(sqlc.arg(ids)::bigint[])
ORDER BY id;

-- name: ListActiveWebhooksByRepo :many
SELECT *
FROM webhooks
WHERE repository_id = $1
  AND is_active = TRUE
ORDER BY id;

-- name: ListWebhooksByRepo :many
SELECT *
FROM webhooks
WHERE repository_id = $1
ORDER BY id;

-- name: CountWebhooksByRepo :one
SELECT COUNT(*)
FROM webhooks
WHERE repository_id = $1;
-- name: ListRepoWebhooksByOwnerAndRepo :many
SELECT w.*
FROM webhooks w
JOIN repositories r ON r.id = w.repository_id
LEFT JOIN users u ON u.id = r.user_id
LEFT JOIN organizations o ON o.id = r.org_id
WHERE (LOWER(u.username) = LOWER(@owner) OR LOWER(o.name) = LOWER(@owner))
  AND r.lower_name = LOWER(@repo)
ORDER BY w.id;

-- name: DeleteRepoWebhookByOwnerAndRepo :execrows
DELETE FROM webhooks w
WHERE w.id = @webhook_id
  AND w.repository_id IN (
    SELECT r.id
    FROM repositories r
    LEFT JOIN users u ON u.id = r.user_id
    LEFT JOIN organizations o ON o.id = r.org_id
    WHERE (LOWER(u.username) = LOWER(@owner) OR LOWER(o.name) = LOWER(@owner))
      AND r.lower_name = LOWER(@repo)
  );

-- name: CreateWebhookDelivery :one
INSERT INTO webhook_deliveries (webhook_id, event_type, payload, status)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: UpdateWebhookDeliveryResult :exec
UPDATE webhook_deliveries
SET status = $2,
    response_status = $3,
    response_body = $4,
    delivered_at = NOW(),
    updated_at = NOW()
WHERE id = $1;

-- name: ClaimDueWebhookDeliveries :many
UPDATE webhook_deliveries
SET attempts = attempts + 1,
    updated_at = NOW()
WHERE id IN (
    SELECT id
    FROM webhook_deliveries
    WHERE status = 'pending'
      AND (next_retry_at IS NULL OR next_retry_at <= NOW())
    ORDER BY id
    LIMIT @claim_limit
    FOR UPDATE SKIP LOCKED
)
RETURNING *;

-- name: UpdateWebhookDeliveryRetry :exec
UPDATE webhook_deliveries
SET status = $2,
    response_status = $3,
    response_body = $4,
    next_retry_at = $5,
    delivered_at = NOW(),
    updated_at = NOW()
WHERE id = $1;

-- name: ListRecentWebhookDeliveryStatuses :many
SELECT status
FROM webhook_deliveries
WHERE webhook_id = $1
ORDER BY id DESC
LIMIT 10;

-- name: SetWebhookActive :exec
UPDATE webhooks
SET is_active = $2,
    updated_at = NOW()
WHERE id = $1;

-- name: UpdateWebhookByID :one
UPDATE webhooks
SET url = $3,
    secret = $4,
    events = $5,
    is_active = $6,
    updated_at = NOW()
WHERE repository_id = $1
  AND id = $2
RETURNING *;

-- name: DeleteWebhookByID :exec
DELETE FROM webhooks
WHERE repository_id = $1
  AND id = $2;

-- name: GetRepoWebhookByOwnerAndRepo :one
SELECT w.*
FROM webhooks w
JOIN repositories r ON r.id = w.repository_id
LEFT JOIN users u ON u.id = r.user_id
LEFT JOIN organizations o ON o.id = r.org_id
WHERE w.id = @webhook_id
  AND (LOWER(u.username) = LOWER(@owner) OR LOWER(o.name) = LOWER(@owner))
  AND r.lower_name = LOWER(@repo);

-- name: UpdateRepoWebhookByOwnerAndRepo :one
UPDATE webhooks w
SET url = @url,
    secret = @secret,
    events = @events,
    is_active = @is_active,
    updated_at = NOW()
FROM repositories r
LEFT JOIN users u ON u.id = r.user_id
LEFT JOIN organizations o ON o.id = r.org_id
WHERE w.id = @webhook_id
  AND w.repository_id = r.id
  AND (LOWER(u.username) = LOWER(@owner) OR LOWER(o.name) = LOWER(@owner))
  AND r.lower_name = LOWER(@repo)
RETURNING w.*;

-- name: ListWebhookDeliveriesForRepo :many
SELECT wd.*
FROM webhook_deliveries wd
JOIN webhooks w ON w.id = wd.webhook_id
JOIN repositories r ON r.id = w.repository_id
LEFT JOIN users u ON u.id = r.user_id
LEFT JOIN organizations o ON o.id = r.org_id
WHERE wd.webhook_id = @webhook_id
  AND w.id = @webhook_id
  AND (LOWER(u.username) = LOWER(@owner) OR LOWER(o.name) = LOWER(@owner))
  AND r.lower_name = LOWER(@repo)
ORDER BY wd.id DESC
LIMIT @page_size OFFSET @page_offset;
