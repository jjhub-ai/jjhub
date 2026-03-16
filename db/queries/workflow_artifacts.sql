-- name: CreateWorkflowArtifact :one
WITH next_artifact AS (
    SELECT nextval(pg_get_serial_sequence('workflow_artifacts', 'id')) AS id
)
INSERT INTO workflow_artifacts (
    id,
    repository_id,
    workflow_run_id,
    name,
    size,
    content_type,
    status,
    gcs_key,
    expires_at
)
SELECT
    next_artifact.id,
    args.repository_id,
    args.workflow_run_id,
    args.name,
    args.size,
    args.content_type,
    'pending',
    concat(
        'repos/',
        args.repository_id,
        '/runs/',
        args.workflow_run_id,
        '/artifacts/',
        next_artifact.id,
        '/',
        args.name
    ),
    args.expires_at
FROM next_artifact
CROSS JOIN (
    VALUES (
        sqlc.arg(repository_id)::bigint,
        sqlc.arg(workflow_run_id)::bigint,
        sqlc.arg(name)::text,
        sqlc.arg(size)::bigint,
        sqlc.arg(content_type)::text,
        sqlc.arg(expires_at)::timestamptz
    )
) AS args(repository_id, workflow_run_id, name, size, content_type, expires_at)
RETURNING
    id,
    repository_id,
    workflow_run_id,
    name,
    size,
    content_type,
    status,
    gcs_key,
    confirmed_at,
    expires_at,
    release_tag,
    release_asset_name,
    release_attached_at,
    created_at,
    updated_at;

-- name: ConfirmWorkflowArtifactUpload :one
UPDATE workflow_artifacts
SET status = 'ready',
    confirmed_at = COALESCE(confirmed_at, NOW()),
    updated_at = NOW()
WHERE workflow_run_id = sqlc.arg(workflow_run_id)
  AND name = sqlc.arg(name)
RETURNING
    id,
    repository_id,
    workflow_run_id,
    name,
    size,
    content_type,
    status,
    gcs_key,
    confirmed_at,
    expires_at,
    release_tag,
    release_asset_name,
    release_attached_at,
    created_at,
    updated_at;

-- name: GetWorkflowDefinitionNameByRunID :one
SELECT wd.name
FROM workflow_runs AS wr
JOIN workflow_definitions AS wd ON wd.id = wr.workflow_definition_id
WHERE wr.id = $1;

-- name: ListWorkflowArtifactsByRun :many
SELECT
    id,
    repository_id,
    workflow_run_id,
    name,
    size,
    content_type,
    status,
    gcs_key,
    confirmed_at,
    expires_at,
    release_tag,
    release_asset_name,
    release_attached_at,
    created_at,
    updated_at
FROM workflow_artifacts
WHERE workflow_run_id = $1
ORDER BY created_at DESC, id DESC;

-- name: GetWorkflowArtifactByName :one
SELECT
    id,
    repository_id,
    workflow_run_id,
    name,
    size,
    content_type,
    status,
    gcs_key,
    confirmed_at,
    expires_at,
    release_tag,
    release_asset_name,
    release_attached_at,
    created_at,
    updated_at
FROM workflow_artifacts
WHERE workflow_run_id = sqlc.arg(workflow_run_id)
  AND name = sqlc.arg(name);

-- name: DeleteWorkflowArtifact :exec
DELETE FROM workflow_artifacts
WHERE workflow_run_id = sqlc.arg(workflow_run_id)
  AND name = sqlc.arg(name);

-- name: DeleteWorkflowArtifactByID :exec
DELETE FROM workflow_artifacts
WHERE id = $1;

-- name: PruneExpiredWorkflowArtifacts :many
DELETE FROM workflow_artifacts
WHERE id IN (
    SELECT wa.id
    FROM workflow_artifacts AS wa
    WHERE wa.expires_at <= sqlc.arg(expires_before)
    ORDER BY wa.expires_at ASC, wa.id ASC
    LIMIT sqlc.arg(limit_rows)
)
RETURNING
    id,
    repository_id,
    workflow_run_id,
    name,
    size,
    content_type,
    status,
    gcs_key,
    confirmed_at,
    expires_at,
    release_tag,
    release_asset_name,
    release_attached_at,
    created_at,
    updated_at;

-- name: AttachWorkflowArtifactToRelease :one
UPDATE workflow_artifacts
SET release_tag = sqlc.arg(release_tag),
    release_asset_name = sqlc.arg(release_asset_name),
    release_attached_at = NOW(),
    updated_at = NOW()
WHERE workflow_run_id = sqlc.arg(workflow_run_id)
  AND name = sqlc.arg(name)
RETURNING
    id,
    repository_id,
    workflow_run_id,
    name,
    size,
    content_type,
    status,
    gcs_key,
    confirmed_at,
    expires_at,
    release_tag,
    release_asset_name,
    release_attached_at,
    created_at,
    updated_at;
