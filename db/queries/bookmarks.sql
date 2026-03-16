-- name: UpsertBookmark :one
INSERT INTO bookmarks (repository_id, name, target_change_id, is_default)
VALUES ($1, $2, $3, $4)
ON CONFLICT (repository_id, name)
DO UPDATE SET
    target_change_id = EXCLUDED.target_change_id,
    is_default = EXCLUDED.is_default,
    updated_at = NOW()
RETURNING *;

-- name: SetDefaultBookmark :one
SELECT set_default_bookmark(sqlc.arg(repository_id), sqlc.arg(name));

-- name: CountBookmarksByRepo :one
SELECT COUNT(*)
FROM bookmarks
WHERE repository_id = $1;

-- name: ListBookmarksByRepo :many
SELECT *
FROM bookmarks
WHERE repository_id = $1
ORDER BY name ASC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: DeleteBookmarkByName :execrows
DELETE FROM bookmarks
WHERE repository_id = $1
  AND name = $2;
