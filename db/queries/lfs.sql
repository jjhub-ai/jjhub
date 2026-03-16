-- name: CreateLFSObject :one
INSERT INTO lfs_objects (repository_id, oid, size, gcs_path)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetLFSObjectByOID :one
SELECT *
FROM lfs_objects
WHERE repository_id = $1
  AND oid = $2;

-- name: ListLFSObjects :many
SELECT *
FROM lfs_objects
WHERE repository_id = $1
ORDER BY id ASC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: CountLFSObjects :one
SELECT COUNT(*)
FROM lfs_objects
WHERE repository_id = $1;

-- name: DeleteLFSObject :exec
DELETE FROM lfs_objects
WHERE repository_id = $1
  AND oid = $2;

-- name: CreateLFSLock :one
INSERT INTO lfs_locks (repository_id, path, owner_id)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetLFSLockByPath :one
SELECT *
FROM lfs_locks
WHERE repository_id = $1
  AND path = $2;

-- name: ListLFSLocks :many
SELECT *
FROM lfs_locks
WHERE repository_id = $1
ORDER BY id ASC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: CountLFSLocks :one
SELECT COUNT(*)
FROM lfs_locks
WHERE repository_id = $1;

-- name: DeleteLFSLockByID :exec
DELETE FROM lfs_locks
WHERE repository_id = $1
  AND id = $2;

-- name: DeleteLFSLockByPath :exec
DELETE FROM lfs_locks
WHERE repository_id = $1
  AND path = $2;
