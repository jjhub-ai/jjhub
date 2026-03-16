-- name: AddIssueDependency :one
INSERT INTO issue_dependencies (issue_id, depends_on_issue_id)
VALUES ($1, $2)
RETURNING *;

-- name: ListIssueDependencies :many
SELECT *
FROM issue_dependencies
WHERE issue_id = $1
ORDER BY depends_on_issue_id ASC;

-- name: ListIssueDependents :many
SELECT *
FROM issue_dependencies
WHERE depends_on_issue_id = $1
ORDER BY issue_id ASC;

-- name: DeleteIssueDependency :exec
DELETE FROM issue_dependencies
WHERE issue_id = $1
  AND depends_on_issue_id = $2;

-- name: DeleteAllIssueDependencies :exec
DELETE FROM issue_dependencies
WHERE issue_id = $1;
