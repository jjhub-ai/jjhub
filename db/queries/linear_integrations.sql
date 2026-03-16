-- name: CreateLinearIntegration :one
INSERT INTO linear_integrations (
    user_id, org_id, linear_team_id, linear_team_name, linear_team_key,
    access_token_encrypted, refresh_token_encrypted, token_expires_at,
    webhook_secret, jjhub_repo_id, jjhub_repo_owner, jjhub_repo_name,
    linear_actor_id
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
RETURNING *;

-- name: GetLinearIntegration :one
SELECT * FROM linear_integrations WHERE id = $1;

-- name: GetLinearIntegrationByUserAndID :one
SELECT * FROM linear_integrations WHERE id = $1 AND user_id = $2;

-- name: GetLinearIntegrationByLinearTeamID :one
SELECT * FROM linear_integrations
WHERE linear_team_id = $1 AND is_active = TRUE
LIMIT 1;

-- name: ListLinearIntegrationsByUser :many
SELECT * FROM linear_integrations
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: ListLinearIntegrationsByRepo :many
SELECT * FROM linear_integrations
WHERE jjhub_repo_id = $1 AND is_active = TRUE
ORDER BY created_at DESC;

-- name: ListActiveLinearIntegrations :many
SELECT * FROM linear_integrations
WHERE is_active = TRUE
ORDER BY id;

-- name: UpdateLinearIntegrationTokens :exec
UPDATE linear_integrations
SET access_token_encrypted = $2,
    refresh_token_encrypted = $3,
    token_expires_at = $4,
    updated_at = NOW()
WHERE id = $1;

-- name: UpdateLinearIntegrationLastSync :exec
UPDATE linear_integrations
SET last_sync_at = NOW(),
    updated_at = NOW()
WHERE id = $1;

-- name: UpdateLinearIntegrationActive :exec
UPDATE linear_integrations
SET is_active = $2,
    updated_at = NOW()
WHERE id = $1;

-- name: DeleteLinearIntegration :exec
DELETE FROM linear_integrations WHERE id = $1 AND user_id = $2;

-- name: CreateLinearIssueMap :one
INSERT INTO linear_issue_map (
    integration_id, jjhub_issue_id, jjhub_issue_number,
    linear_issue_id, linear_identifier
)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetLinearIssueMapByJJHubIssue :one
SELECT * FROM linear_issue_map
WHERE integration_id = $1 AND jjhub_issue_id = $2;

-- name: GetLinearIssueMapByLinearIssue :one
SELECT * FROM linear_issue_map
WHERE integration_id = $1 AND linear_issue_id = $2;

-- name: ListLinearIssueMaps :many
SELECT * FROM linear_issue_map
WHERE integration_id = $1
ORDER BY created_at DESC;

-- name: CreateLinearCommentMap :one
INSERT INTO linear_comment_map (issue_map_id, jjhub_comment_id, linear_comment_id)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetLinearCommentMapByJJHubComment :one
SELECT * FROM linear_comment_map
WHERE issue_map_id = $1 AND jjhub_comment_id = $2;

-- name: GetLinearCommentMapByLinearComment :one
SELECT * FROM linear_comment_map
WHERE issue_map_id = $1 AND linear_comment_id = $2;

-- name: DeleteLinearCommentMapByJJHubComment :exec
DELETE FROM linear_comment_map
WHERE issue_map_id = $1 AND jjhub_comment_id = $2;

-- name: DeleteLinearCommentMapByLinearComment :exec
DELETE FROM linear_comment_map
WHERE issue_map_id = $1 AND linear_comment_id = $2;

-- name: LogLinearSyncOp :one
INSERT INTO linear_sync_ops (
    integration_id, source, target, entity, entity_id, action, status, error_message
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: RecentLinearSyncOpExists :one
SELECT EXISTS (
    SELECT 1 FROM linear_sync_ops
    WHERE integration_id = $1
      AND entity = $2
      AND entity_id = $3
      AND action = $4
      AND status = 'success'
      AND created_at > NOW() - INTERVAL '5 seconds'
) AS exists;
