-- name: UpsertChange :one
INSERT INTO changes (
    repository_id,
    change_id,
    commit_id,
    description,
    author_name,
    author_email,
    has_conflict,
    is_empty,
    parent_change_ids
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT (repository_id, change_id)
DO UPDATE SET
    commit_id = EXCLUDED.commit_id,
    description = EXCLUDED.description,
    author_name = EXCLUDED.author_name,
    author_email = EXCLUDED.author_email,
    has_conflict = EXCLUDED.has_conflict,
    is_empty = EXCLUDED.is_empty,
    parent_change_ids = EXCLUDED.parent_change_ids,
    updated_at = NOW()
RETURNING *;

-- name: GetChangeByChangeID :one
SELECT *
FROM changes
WHERE repository_id = $1
  AND change_id = $2;

-- name: CountChangesByRepo :one
SELECT COUNT(*)
FROM changes
WHERE repository_id = $1;

-- name: ListChangesByRepo :many
SELECT *
FROM changes
WHERE repository_id = $1
ORDER BY id DESC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: DeleteChangesByRepo :execrows
DELETE FROM changes
WHERE repository_id = $1;
