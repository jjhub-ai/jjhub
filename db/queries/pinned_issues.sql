-- name: PinIssue :one
INSERT INTO pinned_issues (repository_id, issue_id, pinned_by_id, position)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: ListPinnedIssues :many
SELECT *
FROM pinned_issues
WHERE repository_id = $1
ORDER BY position ASC;

-- name: UnpinIssue :exec
DELETE FROM pinned_issues
WHERE repository_id = $1
  AND issue_id = $2;

-- name: UpdatePinnedIssuePosition :one
UPDATE pinned_issues
SET position = sqlc.arg(position)
WHERE repository_id = sqlc.arg(repository_id)
  AND issue_id = sqlc.arg(issue_id)
RETURNING *;
