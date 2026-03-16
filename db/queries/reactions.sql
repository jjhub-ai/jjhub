-- name: AddReaction :one
INSERT INTO reactions (user_id, target_type, target_id, emoji)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: ListReactions :many
SELECT *
FROM reactions
WHERE target_type = sqlc.arg(target_type)
  AND target_id = sqlc.arg(target_id)
ORDER BY created_at ASC;

-- name: CountReactions :one
SELECT COUNT(*)
FROM reactions
WHERE target_type = sqlc.arg(target_type)
  AND target_id = sqlc.arg(target_id);

-- name: DeleteReaction :exec
DELETE FROM reactions
WHERE user_id = $1
  AND target_type = $2
  AND target_id = $3
  AND emoji = $4;

-- name: DeleteAllReactionsForTarget :exec
DELETE FROM reactions
WHERE target_type = sqlc.arg(target_type)
  AND target_id = sqlc.arg(target_id);
