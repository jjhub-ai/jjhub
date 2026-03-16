-- name: CreateRepo :one
INSERT INTO repositories (user_id, name, lower_name, description, shard_id, is_public, default_bookmark)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: CreateOrgRepo :one
INSERT INTO repositories (org_id, name, lower_name, description, shard_id, is_public, default_bookmark)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: DeleteRepo :exec
DELETE FROM repositories WHERE id = $1;

-- name: GetRepoByOwnerAndName :one
SELECT r.id, r.user_id, r.org_id, r.name, r.lower_name, r.is_public, r.is_archived
FROM repositories r
LEFT JOIN users u ON r.user_id = u.id
LEFT JOIN organizations o ON r.org_id = o.id
WHERE r.lower_name = LOWER(sqlc.arg(name))
  AND (
    (r.user_id IS NOT NULL AND u.lower_username = LOWER(sqlc.arg(owner)))
    OR
    (r.org_id IS NOT NULL AND o.lower_name = LOWER(sqlc.arg(owner)))
  )
LIMIT 1;

-- name: IsOrgOwnerForRepoUser :one
SELECT EXISTS (
  SELECT 1
  FROM repositories r
  JOIN org_members om ON om.organization_id = r.org_id
  WHERE r.id = sqlc.arg(repository_id)
    AND om.user_id = sqlc.arg(user_id)
    AND om.role = 'owner'
);

-- name: GetHighestTeamPermissionForRepoUser :one
SELECT COALESCE((
  SELECT t.permission
  FROM team_repos tr
  JOIN teams t ON t.id = tr.team_id
  JOIN team_members tm ON tm.team_id = t.id
  WHERE tr.repository_id = sqlc.arg(repository_id)
    AND tm.user_id = sqlc.arg(user_id)
  ORDER BY CASE t.permission
    WHEN 'admin' THEN 3
    WHEN 'write' THEN 2
    WHEN 'read' THEN 1
    ELSE 0
  END DESC
  LIMIT 1
), '')::text;

-- name: GetRepoByID :one
SELECT *
FROM repositories
WHERE id = $1;

-- name: GetRepoByOwnerAndLowerName :one
SELECT r.*
FROM repositories r
LEFT JOIN users u ON u.id = r.user_id
LEFT JOIN organizations o ON o.id = r.org_id
WHERE r.lower_name = sqlc.arg(lower_name)
  AND (
    u.lower_username = sqlc.arg(owner)
    OR o.lower_name = sqlc.arg(owner)
  )
LIMIT 1;

-- name: ListUserRepos :many
SELECT *
FROM repositories
WHERE user_id = sqlc.arg(user_id)
ORDER BY updated_at DESC, id DESC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: ListPublicUserRepos :many
SELECT *
FROM repositories
WHERE user_id = sqlc.arg(user_id)
  AND is_public = TRUE
ORDER BY updated_at DESC, id DESC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: ListOrgRepos :many
SELECT *
FROM repositories
WHERE org_id = sqlc.arg(org_id)
ORDER BY updated_at DESC, id DESC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: ListPublicOrgRepos :many
SELECT *
FROM repositories
WHERE org_id = sqlc.arg(org_id)
  AND is_public = TRUE
ORDER BY updated_at DESC, id DESC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: UpdateRepo :one
UPDATE repositories
SET name = sqlc.arg(name),
    lower_name = sqlc.arg(lower_name),
    description = sqlc.arg(description),
    is_public = sqlc.arg(is_public),
    default_bookmark = sqlc.arg(default_bookmark),
    topics = sqlc.arg(topics),
    updated_at = NOW()
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: UpdateRepoTopics :one
UPDATE repositories
SET topics = sqlc.arg(topics),
    updated_at = NOW()
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: UpdateRepoConfigState :one
UPDATE repositories
SET description = sqlc.arg(description),
    is_public = sqlc.arg(is_public),
    topics = COALESCE(sqlc.arg(topics)::text[], '{}'::text[]),
    is_mirror = sqlc.arg(is_mirror),
    mirror_destination = sqlc.arg(mirror_destination),
    workspace_idle_timeout_secs = sqlc.arg(workspace_idle_timeout_secs),
    workspace_persistence = sqlc.arg(workspace_persistence),
    workspace_dependencies = COALESCE(sqlc.arg(workspace_dependencies)::text[], '{}'::text[]),
    landing_queue_mode = sqlc.arg(landing_queue_mode),
    landing_queue_required_checks = COALESCE(sqlc.arg(landing_queue_required_checks)::text[], '{}'::text[]),
    updated_at = NOW()
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: IncrementRepoStars :exec
UPDATE repositories
SET num_stars = num_stars + 1,
    updated_at = NOW()
WHERE id = $1;

-- name: DecrementRepoStars :exec
UPDATE repositories
SET num_stars = GREATEST(num_stars - 1, 0),
    updated_at = NOW()
WHERE id = $1;

-- name: IncrementRepoForks :exec
UPDATE repositories
SET num_forks = num_forks + 1,
    updated_at = NOW()
WHERE id = $1;

-- name: CountUserRepos :one
SELECT COUNT(*)
FROM repositories
WHERE user_id = $1;

-- name: CountPublicUserRepos :one
SELECT COUNT(*)
FROM repositories
WHERE user_id = $1
  AND is_public = TRUE;

-- name: CountOrgRepos :one
SELECT COUNT(*)
FROM repositories
WHERE org_id = $1;

-- name: CountPublicOrgRepos :one
SELECT COUNT(*)
FROM repositories
WHERE org_id = $1
  AND is_public = TRUE;

-- name: ListAllRepos :many
SELECT *
FROM repositories
ORDER BY updated_at DESC, id DESC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: CountAllRepos :one
SELECT COUNT(*)
FROM repositories;

-- name: ArchiveRepo :one
UPDATE repositories
SET is_archived = TRUE,
    archived_at = NOW(),
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UnarchiveRepo :one
UPDATE repositories
SET is_archived = FALSE,
    archived_at = NULL,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: TransferRepoToUser :one
UPDATE repositories
SET user_id = sqlc.arg(new_user_id),
    org_id = NULL,
    updated_at = NOW()
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: TransferRepoToOrg :one
UPDATE repositories
SET org_id = sqlc.arg(new_org_id),
    user_id = NULL,
    updated_at = NOW()
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: DeleteCollaboratorsByRepo :exec
DELETE FROM collaborators
WHERE repository_id = $1;

-- name: DeleteTeamReposByRepo :exec
DELETE FROM team_repos
WHERE repository_id = $1;

-- name: CreateForkRepo :one
INSERT INTO repositories (user_id, name, lower_name, description, shard_id, is_public, default_bookmark, is_fork, fork_id)
VALUES (sqlc.arg(user_id), sqlc.arg(name), sqlc.arg(lower_name), sqlc.arg(description), sqlc.arg(shard_id), sqlc.arg(is_public), sqlc.arg(default_bookmark), TRUE, sqlc.arg(fork_id))
RETURNING *;

-- name: CountRepoForks :one
SELECT COUNT(*)
FROM repositories
WHERE fork_id = $1;

-- name: ListRepoForks :many
SELECT *
FROM repositories
WHERE fork_id = sqlc.arg(fork_id)
ORDER BY created_at DESC, id DESC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: AddCollaborator :one
INSERT INTO collaborators (repository_id, user_id, permission)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetCollaboratorPermissionForRepoUser :one
SELECT COALESCE(
    (SELECT permission FROM collaborators WHERE repository_id = $1 AND user_id = $2),
    ''
)::text AS permission;
