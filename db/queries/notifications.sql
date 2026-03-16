-- name: ListNotificationsByUser :many
SELECT *
FROM notifications
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: CreateNotification :one
INSERT INTO notifications (user_id, source_type, source_id, subject, body)
VALUES (
    sqlc.arg(user_id),
    sqlc.arg(source_type),
    sqlc.arg(source_id),
    sqlc.arg(subject),
    sqlc.arg(body)
)
RETURNING *;

-- name: CountNotificationsByUser :one
SELECT COUNT(*)
FROM notifications
WHERE user_id = $1;

-- name: NotifyUser :exec
SELECT pg_notify(
    'user_notifications_' || sqlc.arg(user_id)::bigint::text,
    sqlc.arg(payload)::text
);

-- name: MarkNotificationRead :exec
UPDATE notifications
SET status = 'read',
    read_at = NOW(),
    updated_at = NOW()
WHERE id = $1
  AND user_id = $2;

-- name: ListNotificationsAfterID :many
SELECT *
FROM notifications
WHERE user_id = $1
  AND id > sqlc.arg(after_id)
ORDER BY id ASC
LIMIT sqlc.arg(max_results);

-- name: MarkAllNotificationsRead :exec
UPDATE notifications
SET status = 'read',
    read_at = NOW(),
    updated_at = NOW()
WHERE user_id = $1
  AND status = 'unread';
