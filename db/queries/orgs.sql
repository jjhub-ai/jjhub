-- name: CreateOrganization :one
INSERT INTO organizations (name, lower_name, description, visibility)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: AddOrgMember :one
INSERT INTO org_members (organization_id, user_id, role)
VALUES ($1, $2, $3)
RETURNING *;

-- name: CreateTeam :one
INSERT INTO teams (organization_id, name, lower_name, description, permission)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: AddTeamMember :one
INSERT INTO team_members (team_id, user_id)
VALUES ($1, $2)
RETURNING *;

-- name: AddTeamMemberIfOrgMember :one
INSERT INTO team_members (team_id, user_id)
SELECT sqlc.arg(team_id), sqlc.arg(user_id)
WHERE EXISTS (
    SELECT 1
    FROM teams t
    JOIN org_members om ON om.organization_id = t.organization_id
    WHERE t.id = sqlc.arg(team_id)
      AND om.user_id = sqlc.arg(user_id)
)
RETURNING *;

-- name: AddTeamRepo :one
INSERT INTO team_repos (team_id, repository_id)
VALUES ($1, $2)
RETURNING *;

-- name: AddTeamRepoIfOrgRepo :one
INSERT INTO team_repos (team_id, repository_id)
SELECT sqlc.arg(team_id), sqlc.arg(repository_id)
WHERE EXISTS (
    SELECT 1
    FROM teams t
    JOIN repositories r ON r.id = sqlc.arg(repository_id)
    WHERE t.id = sqlc.arg(team_id)
      AND r.org_id = t.organization_id
)
RETURNING *;

-- name: GetOrgByID :one
SELECT *
FROM organizations
WHERE id = $1;

-- name: GetOrgByLowerName :one
SELECT *
FROM organizations
WHERE lower_name = $1;

-- name: UpdateOrganization :one
UPDATE organizations
SET name = sqlc.arg(name),
    lower_name = sqlc.arg(lower_name),
    description = sqlc.arg(description),
    visibility = sqlc.arg(visibility),
    website = sqlc.arg(website),
    location = sqlc.arg(location),
    updated_at = NOW()
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: DeleteOrganization :exec
DELETE FROM organizations
WHERE id = $1;

-- name: ListOrgMembers :many
SELECT
    u.*,
    om.role
FROM org_members om
JOIN users u ON u.id = om.user_id
WHERE om.organization_id = sqlc.arg(organization_id)
ORDER BY u.id ASC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: GetOrgMember :one
SELECT *
FROM org_members
WHERE organization_id = sqlc.arg(organization_id)
  AND user_id = sqlc.arg(user_id);

-- name: RemoveOrgMember :exec
DELETE FROM org_members
WHERE organization_id = sqlc.arg(organization_id)
  AND user_id = sqlc.arg(user_id);

-- name: UpdateOrgMemberRole :exec
UPDATE org_members
SET role = sqlc.arg(role),
    updated_at = NOW()
WHERE organization_id = sqlc.arg(organization_id)
  AND user_id = sqlc.arg(user_id);

-- name: ListUserOrgs :many
SELECT o.*
FROM organizations o
JOIN org_members om ON om.organization_id = o.id
WHERE om.user_id = sqlc.arg(user_id)
ORDER BY o.id ASC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: CountUserOrgs :one
SELECT COUNT(*)
FROM org_members
WHERE user_id = sqlc.arg(user_id);

-- name: ListOrgTeams :many
SELECT *
FROM teams
WHERE organization_id = sqlc.arg(organization_id)
ORDER BY id ASC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: GetTeamByID :one
SELECT *
FROM teams
WHERE id = $1;

-- name: GetTeamByOrgAndLowerName :one
SELECT *
FROM teams
WHERE organization_id = sqlc.arg(organization_id)
  AND lower_name = sqlc.arg(lower_name);

-- name: UpdateTeam :one
UPDATE teams
SET name = sqlc.arg(name),
    lower_name = sqlc.arg(lower_name),
    description = sqlc.arg(description),
    permission = sqlc.arg(permission),
    updated_at = NOW()
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: DeleteTeam :exec
DELETE FROM teams
WHERE id = $1;

-- name: ListTeamMembers :many
SELECT u.*
FROM team_members tm
JOIN users u ON u.id = tm.user_id
WHERE tm.team_id = sqlc.arg(team_id)
ORDER BY u.id ASC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: CountTeamMembers :one
SELECT COUNT(*)
FROM team_members
WHERE team_id = sqlc.arg(team_id);

-- name: RemoveTeamMember :exec
DELETE FROM team_members
WHERE team_id = sqlc.arg(team_id)
  AND user_id = sqlc.arg(user_id);

-- name: ListTeamRepos :many
SELECT r.*
FROM team_repos tr
JOIN repositories r ON r.id = tr.repository_id
WHERE tr.team_id = sqlc.arg(team_id)
ORDER BY r.id ASC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: CountTeamRepos :one
SELECT COUNT(*)
FROM team_repos
WHERE team_id = sqlc.arg(team_id);

-- name: RemoveTeamRepo :exec
DELETE FROM team_repos
WHERE team_id = sqlc.arg(team_id)
  AND repository_id = sqlc.arg(repository_id);

-- name: CountOrgMembers :one
SELECT COUNT(*)
FROM org_members
WHERE organization_id = $1;

-- name: CountOrgTeams :one
SELECT COUNT(*)
FROM teams
WHERE organization_id = $1;

-- name: CountOrgOwners :one
SELECT COUNT(*)
FROM org_members
WHERE organization_id = $1 AND role = 'owner';

-- name: ListAllOrgs :many
SELECT *
FROM organizations
ORDER BY id ASC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: CountAllOrgs :one
SELECT COUNT(*)
FROM organizations;
