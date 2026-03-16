-- name: CreateMention :one
INSERT INTO mentions (repository_id, issue_id, landing_request_id, comment_type, comment_id, user_id, mentioned_user_id)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: ListMentionsForUser :many
SELECT *
FROM mentions
WHERE mentioned_user_id = sqlc.arg(mentioned_user_id)
ORDER BY created_at DESC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: CountMentionsForUser :one
SELECT COUNT(*)
FROM mentions
WHERE mentioned_user_id = $1;

-- name: DeleteMentionsForComment :exec
DELETE FROM mentions
WHERE comment_type = sqlc.arg(comment_type)
  AND comment_id = sqlc.arg(comment_id);
