-- name: CreateJjOperation :one
INSERT INTO jj_operations (
    repository_id,
    operation_id,
    operation_type,
    description,
    user_id,
    parent_operation_id
)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetJjOperationByOperationID :one
SELECT *
FROM jj_operations
WHERE repository_id = $1
  AND operation_id = $2;

-- name: CountJjOperationsByRepo :one
SELECT COUNT(*)
FROM jj_operations
WHERE repository_id = $1;

-- name: ListJjOperationsByRepo :many
SELECT *
FROM jj_operations
WHERE repository_id = $1
ORDER BY created_at DESC, id DESC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);
