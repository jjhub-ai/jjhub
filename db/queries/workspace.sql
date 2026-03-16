-- ---- Workspace (Sandbox VM lifecycle) ----

-- name: CreateWorkspace :one
INSERT INTO workspaces (
    repository_id,
    user_id,
    name,
    is_fork,
    parent_workspace_id,
    source_snapshot_id,
    status
)
VALUES ($1, $2, $3, $4, $5, $6, sqlc.arg(status)::text)
RETURNING *;

-- name: GetWorkspace :one
SELECT *
FROM workspaces
WHERE id = $1;

-- name: GetWorkspaceForUserRepo :one
SELECT *
FROM workspaces
WHERE id = sqlc.arg(id)
  AND repository_id = sqlc.arg(repository_id)
  AND user_id = sqlc.arg(user_id);

-- name: ListWorkspacesByRepo :many
SELECT *
FROM workspaces
WHERE repository_id = sqlc.arg(repository_id)
  AND user_id = sqlc.arg(user_id)
ORDER BY created_at DESC
LIMIT sqlc.arg(page_size) OFFSET sqlc.arg(page_offset);

-- name: CountWorkspacesByRepo :one
SELECT COUNT(*)
FROM workspaces
WHERE repository_id = sqlc.arg(repository_id)
  AND user_id = sqlc.arg(user_id);

-- name: GetActiveWorkspaceForUserRepo :one
-- Returns the active (reusable) workspace for a user+repo pair.
SELECT *
FROM workspaces
WHERE repository_id = $1
  AND user_id = $2
  AND is_fork = FALSE
  AND (
    status IN ('running', 'suspended')
    OR (status = 'starting' AND vm_id <> '')
  )
LIMIT 1;

-- name: UpdateWorkspaceStatus :one
UPDATE workspaces
SET status = sqlc.arg(status)::text,
    suspended_at = CASE
        WHEN sqlc.arg(status)::text = 'suspended' THEN NOW()
        WHEN sqlc.arg(status)::text = 'running' THEN NULL::timestamptz
        ELSE suspended_at
    END,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateWorkspaceExecutionInfo :one
UPDATE workspaces
SET vm_id = $2,
    status = sqlc.arg(status)::text,
    suspended_at = CASE
        WHEN sqlc.arg(status)::text = 'suspended' THEN NOW()
        WHEN sqlc.arg(status)::text = 'running' THEN NULL::timestamptz
        ELSE suspended_at
    END,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateWorkspaceSessionSSHConnectionInfo :one
UPDATE workspace_sessions
SET ssh_connection_info = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- ---- Workspace snapshots ----

-- name: CreateWorkspaceSnapshot :one
INSERT INTO workspace_snapshots (
    repository_id,
    user_id,
    workspace_id,
    name,
    snapshot_id
)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetWorkspaceSnapshot :one
SELECT *
FROM workspace_snapshots
WHERE id = $1;

-- name: GetWorkspaceSnapshotForUserRepo :one
SELECT *
FROM workspace_snapshots
WHERE id = sqlc.arg(id)
  AND repository_id = sqlc.arg(repository_id)
  AND user_id = sqlc.arg(user_id);

-- name: ListWorkspaceSnapshotsByRepo :many
SELECT *
FROM workspace_snapshots
WHERE repository_id = sqlc.arg(repository_id)
  AND user_id = sqlc.arg(user_id)
ORDER BY created_at DESC
LIMIT sqlc.arg(page_size) OFFSET sqlc.arg(page_offset);

-- name: CountWorkspaceSnapshotsByRepo :one
SELECT COUNT(*)
FROM workspace_snapshots
WHERE repository_id = sqlc.arg(repository_id)
  AND user_id = sqlc.arg(user_id);

-- name: DeleteWorkspaceSnapshot :exec
DELETE FROM workspace_snapshots
WHERE id = $1;

-- ---- PG NOTIFY ----

-- name: NotifyWorkspaceStatus :exec
-- Notifies SSE listeners of session status changes.
-- Channel: workspace_status_{session_id_no_dashes}
SELECT pg_notify(
    'workspace_status_' || replace(sqlc.arg(session_id)::text, '-', ''),
    sqlc.arg(payload)::text
);

-- ---- Workflow Integration ----

-- name: UpsertWorkspaceWorkflowDefinition :one
-- Creates or returns the per-repo workspace workflow definition.
-- Uses the UNIQUE(repository_id, path) constraint for idempotent upserts.
INSERT INTO workflow_definitions (repository_id, name, path, config)
VALUES (sqlc.arg(repository_id), 'Workspace', '.jjhub/workspace', '{"workspace": true}'::jsonb)
ON CONFLICT (repository_id, path) DO UPDATE SET updated_at = NOW()
RETURNING *;

-- ---- Session (PTY) lifecycle ----

-- name: CreateWorkspaceSession :one
INSERT INTO workspace_sessions (workspace_id, repository_id, user_id, cols, rows)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetWorkspaceSession :one
SELECT *
FROM workspace_sessions
WHERE id = $1;

-- name: GetWorkspaceSessionForUserRepo :one
SELECT *
FROM workspace_sessions
WHERE id = sqlc.arg(id)
  AND repository_id = sqlc.arg(repository_id)
  AND user_id = sqlc.arg(user_id);

-- name: ListWorkspaceSessionsByRepo :many
SELECT *
FROM workspace_sessions
WHERE repository_id = sqlc.arg(repository_id)
  AND user_id = sqlc.arg(user_id)
ORDER BY created_at DESC
LIMIT sqlc.arg(page_size) OFFSET sqlc.arg(page_offset);

-- name: CountWorkspaceSessionsByRepo :one
SELECT COUNT(*)
FROM workspace_sessions
WHERE repository_id = sqlc.arg(repository_id)
  AND user_id = sqlc.arg(user_id);

-- name: UpdateWorkspaceSessionStatus :one
UPDATE workspace_sessions
SET status = $2, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: TouchWorkspaceSessionActivity :exec
UPDATE workspace_sessions
SET last_activity_at = NOW(), updated_at = NOW()
WHERE id = $1;

-- ---- Activity Tracking ----

-- name: TouchWorkspaceActivity :exec
UPDATE workspaces
SET last_activity_at = NOW(), updated_at = NOW()
WHERE id = $1;

-- name: ListPendingSessionsForWorkspace :many
SELECT *
FROM workspace_sessions
WHERE workspace_id = $1
  AND status IN ('pending', 'starting');

-- ---- Idle Tracking ----

-- name: CountActiveSessionsForWorkspace :one
SELECT COUNT(*)
FROM workspace_sessions
WHERE workspace_id = $1
  AND status IN ('pending', 'starting', 'running');

-- name: CountActiveSessionsForUser :one
SELECT COUNT(*)
FROM workspace_sessions
WHERE user_id = $1
  AND status IN ('pending', 'starting', 'running');

-- name: ListIdleWorkspaces :many
-- Finds workspaces with status=running whose last_activity_at > idle_timeout_secs ago.
SELECT w.*
FROM workspaces w
WHERE w.status = 'running'
  AND NOW() > w.last_activity_at + make_interval(secs => w.idle_timeout_secs);

-- name: ListStalePendingWorkspaces :many
-- Finds pending/starting workspaces with no VM assignment that have been stale past the threshold.
SELECT *
FROM workspaces
WHERE status IN ('pending', 'starting')
  AND vm_id = ''
  AND updated_at < NOW() - make_interval(secs => sqlc.arg(stale_after_secs)::int)
ORDER BY updated_at ASC;

-- name: ListIdleWorkspaceSessions :many
-- Finds sessions with status=running whose last_activity_at > idle_timeout_secs ago.
SELECT s.*
FROM workspace_sessions s
WHERE s.status = 'running'
  AND NOW() > s.last_activity_at + make_interval(secs => s.idle_timeout_secs);
