-- name: GetWorkflowCacheByID :one
SELECT *
FROM workflow_caches
WHERE id = sqlc.arg(id);

-- name: GetWorkflowCacheByScopeVersion :one
SELECT *
FROM workflow_caches
WHERE repository_id = sqlc.arg(repository_id)
  AND bookmark_name = sqlc.arg(bookmark_name)
  AND cache_key = sqlc.arg(cache_key)
  AND cache_version = sqlc.arg(cache_version)
LIMIT 1;

-- name: FindWorkflowCacheForRestore :one
SELECT *
FROM workflow_caches
WHERE repository_id = sqlc.arg(repository_id)
  AND status = 'finalized'
  AND expires_at > NOW()
  AND cache_key = sqlc.arg(cache_key)
  AND cache_version = sqlc.arg(cache_version)
  AND bookmark_name IN (sqlc.arg(bookmark_name), sqlc.arg(default_bookmark))
ORDER BY
    CASE
        WHEN bookmark_name = sqlc.arg(bookmark_name) THEN 0
        ELSE 1
    END,
    finalized_at DESC NULLS LAST,
    id DESC
LIMIT 1;

-- name: UpsertPendingWorkflowCache :one
WITH upserted AS (
    INSERT INTO workflow_caches (
        repository_id,
        workflow_run_id,
        bookmark_name,
        cache_key,
        cache_version,
        object_key,
        compression,
        status,
        expires_at
    )
    VALUES (
        sqlc.arg(repository_id),
        sqlc.arg(workflow_run_id),
        sqlc.arg(bookmark_name),
        sqlc.arg(cache_key),
        sqlc.arg(cache_version),
        sqlc.arg(object_key),
        sqlc.arg(compression),
        'pending',
        sqlc.arg(expires_at)
    )
    ON CONFLICT (repository_id, bookmark_name, cache_key, cache_version)
    DO UPDATE SET
        workflow_run_id = EXCLUDED.workflow_run_id,
        object_key = EXCLUDED.object_key,
        compression = EXCLUDED.compression,
        status = 'pending',
        object_size_bytes = 0,
        finalized_at = NULL,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    WHERE workflow_caches.status <> 'finalized'
      AND (
        workflow_caches.workflow_run_id IS NULL
        OR workflow_caches.workflow_run_id = EXCLUDED.workflow_run_id
        OR workflow_caches.expires_at <= NOW()
      )
    RETURNING id
),
selected AS (
    SELECT id
    FROM upserted
    UNION ALL
    SELECT id
    FROM workflow_caches
    WHERE repository_id = sqlc.arg(repository_id)
      AND bookmark_name = sqlc.arg(bookmark_name)
      AND cache_key = sqlc.arg(cache_key)
      AND cache_version = sqlc.arg(cache_version)
      AND NOT EXISTS (SELECT 1 FROM upserted)
)
SELECT workflow_caches.*
FROM workflow_caches
JOIN selected ON selected.id = workflow_caches.id;

-- name: FinalizeWorkflowCache :one
UPDATE workflow_caches
SET status = 'finalized',
    object_size_bytes = sqlc.arg(object_size_bytes),
    expires_at = sqlc.arg(expires_at),
    finalized_at = NOW(),
    updated_at = NOW()
WHERE id = sqlc.arg(id)
  AND status = 'pending'
RETURNING *;

-- name: TouchWorkflowCacheHit :exec
UPDATE workflow_caches
SET hit_count = hit_count + 1,
    last_hit_at = NOW(),
    updated_at = NOW()
WHERE id = sqlc.arg(id)
  AND status = 'finalized';

-- name: ListWorkflowCaches :many
SELECT *
FROM workflow_caches
WHERE repository_id = sqlc.arg(repository_id)
  AND status = 'finalized'
  AND (
    sqlc.arg(bookmark_name)::text = ''
    OR bookmark_name = sqlc.arg(bookmark_name)
  )
  AND (
    sqlc.arg(cache_key)::text = ''
    OR cache_key = sqlc.arg(cache_key)
  )
ORDER BY updated_at DESC, id DESC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: ListWorkflowCachesForClear :many
SELECT *
FROM workflow_caches
WHERE repository_id = sqlc.arg(repository_id)
  AND status = 'finalized'
  AND (
    sqlc.arg(bookmark_name)::text = ''
    OR bookmark_name = sqlc.arg(bookmark_name)
  )
  AND (
    sqlc.arg(cache_key)::text = ''
    OR cache_key = sqlc.arg(cache_key)
  )
ORDER BY updated_at DESC, id DESC;

-- name: DeleteWorkflowCacheByID :one
DELETE FROM workflow_caches
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: GetWorkflowCacheRepoUsage :one
SELECT COALESCE(SUM(object_size_bytes), 0)::bigint
FROM workflow_caches
WHERE repository_id = sqlc.arg(repository_id)
  AND status = 'finalized';

-- name: GetWorkflowCacheStats :one
SELECT
    COALESCE(COUNT(*) FILTER (WHERE status = 'finalized'), 0)::bigint AS cache_count,
    COALESCE(SUM(object_size_bytes) FILTER (WHERE status = 'finalized'), 0)::bigint AS total_size_bytes,
    MAX(last_hit_at) FILTER (WHERE status = 'finalized') AS last_hit_at,
    MAX(expires_at) FILTER (WHERE status = 'finalized') AS max_expires_at
FROM workflow_caches
WHERE repository_id = sqlc.arg(repository_id);

-- name: ListWorkflowCacheRepositoryIDs :many
SELECT DISTINCT repository_id
FROM workflow_caches
ORDER BY repository_id ASC;

-- name: ListWorkflowCacheEvictionCandidates :many
SELECT *
FROM workflow_caches
WHERE repository_id = sqlc.arg(repository_id)
  AND status IN ('pending', 'finalized')
ORDER BY
    CASE
        WHEN expires_at <= NOW() THEN 0
        WHEN status = 'finalized' THEN 1
        ELSE 2
    END,
    COALESCE(last_hit_at, finalized_at, updated_at, created_at) ASC,
    id ASC
LIMIT sqlc.arg(limit_count);
