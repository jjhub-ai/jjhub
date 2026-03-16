-- name: CreateIssueArtifact :one
WITH next_artifact AS (
    SELECT nextval(pg_get_serial_sequence('issue_artifacts', 'id')) AS id
)
INSERT INTO issue_artifacts (
    id,
    repository_id,
    issue_id,
    name,
    step_name,
    size,
    content_type,
    status,
    gcs_key,
    expires_at
)
SELECT
    next_artifact.id,
    args.repository_id,
    args.issue_id,
    args.name,
    args.step_name,
    args.size,
    args.content_type,
    'pending',
    concat(
        'repos/',
        args.repository_id,
        '/issues/',
        args.issue_id,
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
        sqlc.arg(issue_id)::bigint,
        sqlc.arg(name)::text,
        sqlc.arg(step_name)::text,
        sqlc.arg(size)::bigint,
        sqlc.arg(content_type)::text,
        sqlc.arg(expires_at)::timestamptz
    )
) AS args(repository_id, issue_id, name, step_name, size, content_type, expires_at)
RETURNING
    id,
    repository_id,
    issue_id,
    name,
    step_name,
    size,
    content_type,
    status,
    gcs_key,
    confirmed_at,
    expires_at,
    created_at,
    updated_at;

-- name: ConfirmIssueArtifactUpload :one
UPDATE issue_artifacts
SET status = 'ready',
    confirmed_at = COALESCE(confirmed_at, NOW()),
    updated_at = NOW()
WHERE issue_id = sqlc.arg(issue_id)
  AND name = sqlc.arg(name)
RETURNING
    id,
    repository_id,
    issue_id,
    name,
    step_name,
    size,
    content_type,
    status,
    gcs_key,
    confirmed_at,
    expires_at,
    created_at,
    updated_at;

-- name: ListIssueArtifactsByIssue :many
SELECT
    id,
    repository_id,
    issue_id,
    name,
    step_name,
    size,
    content_type,
    status,
    gcs_key,
    confirmed_at,
    expires_at,
    created_at,
    updated_at
FROM issue_artifacts
WHERE issue_id = $1
ORDER BY created_at DESC, id DESC;

-- name: GetIssueArtifactByName :one
SELECT
    id,
    repository_id,
    issue_id,
    name,
    step_name,
    size,
    content_type,
    status,
    gcs_key,
    confirmed_at,
    expires_at,
    created_at,
    updated_at
FROM issue_artifacts
WHERE issue_id = sqlc.arg(issue_id)
  AND name = sqlc.arg(name);

-- name: DeleteIssueArtifact :exec
DELETE FROM issue_artifacts
WHERE issue_id = sqlc.arg(issue_id)
  AND name = sqlc.arg(name);

-- name: DeleteIssueArtifactByID :exec
DELETE FROM issue_artifacts
WHERE id = $1;

-- name: PruneExpiredIssueArtifacts :many
DELETE FROM issue_artifacts
WHERE id IN (
    SELECT ia.id
    FROM issue_artifacts AS ia
    WHERE ia.expires_at <= sqlc.arg(expires_before)
    ORDER BY ia.expires_at ASC, ia.id ASC
    LIMIT sqlc.arg(limit_rows)
)
RETURNING
    id,
    repository_id,
    issue_id,
    name,
    step_name,
    size,
    content_type,
    status,
    gcs_key,
    confirmed_at,
    expires_at,
    created_at,
    updated_at;

-- name: GetIssueIDByRepoAndNumber :one
SELECT id
FROM issues
WHERE repository_id = sqlc.arg(repository_id)
  AND number = sqlc.arg(number);
