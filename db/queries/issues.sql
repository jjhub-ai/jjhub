-- name: CreateIssue :one
INSERT INTO issues (repository_id, number, title, body, state, author_id, milestone_id)
VALUES ($1, get_next_issue_number($1), $2, $3, 'open', $4, $5)
RETURNING *;

-- name: GetIssueByNumber :one
SELECT *
FROM issues
WHERE repository_id = $1
  AND number = $2;

-- name: GetIssueByID :one
SELECT *
FROM issues
WHERE id = $1;

-- name: ListIssuesByRepoFiltered :many
SELECT *
FROM issues
WHERE repository_id = sqlc.arg(repository_id)
  AND (sqlc.arg(state)::text = '' OR state = sqlc.arg(state)::text)
ORDER BY number DESC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: CountIssuesByRepoFiltered :one
SELECT COUNT(*)
FROM issues
WHERE repository_id = sqlc.arg(repository_id)
  AND (sqlc.arg(state)::text = '' OR state = sqlc.arg(state)::text);

-- name: UpdateIssue :one
UPDATE issues
SET title = sqlc.arg(title),
    body = sqlc.arg(body),
    state = sqlc.arg(state),
    milestone_id = sqlc.arg(milestone_id),
    closed_at = sqlc.arg(closed_at),
    updated_at = NOW()
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: AddIssueAssignee :one
INSERT INTO issue_assignees (issue_id, user_id)
VALUES ($1, $2)
RETURNING *;

-- name: DeleteIssueAssignees :exec
DELETE FROM issue_assignees
WHERE issue_id = $1;

-- name: DeleteIssueLabels :exec
DELETE FROM issue_labels
WHERE issue_id = $1;

-- name: ListIssueAssignees :many
SELECT u.id, u.username, u.display_name, u.avatar_url
FROM issue_assignees ia
JOIN users u ON u.id = ia.user_id
WHERE ia.issue_id = $1
ORDER BY u.username ASC;

-- name: CreateIssueComment :one
INSERT INTO issue_comments (issue_id, user_id, body, commenter, type)
VALUES ($1, $2, $3, $4, 'comment')
RETURNING *;

-- name: CreateIssueEvent :one
INSERT INTO issue_events (issue_id, actor_id, event_type, payload)
VALUES (
    sqlc.arg(issue_id),
    sqlc.arg(actor_id),
    sqlc.arg(event_type),
    sqlc.arg(payload)
)
RETURNING *;

-- name: ListIssueComments :many
SELECT *
FROM issue_comments
WHERE issue_id = $1
ORDER BY created_at ASC, id ASC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: ListIssueEventsByIssue :many
SELECT *
FROM issue_events
WHERE issue_id = sqlc.arg(issue_id)
ORDER BY created_at ASC, id ASC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: CountIssueCommentsByIssue :one
SELECT COUNT(*)
FROM issue_comments
WHERE issue_id = $1;

-- name: GetIssueCommentByID :one
SELECT *
FROM issue_comments
WHERE id = $1;

-- name: UpdateIssueComment :one
UPDATE issue_comments
SET body = sqlc.arg(body),
    updated_at = NOW()
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: DeleteIssueComment :exec
DELETE FROM issue_comments
WHERE id = $1;

-- name: GetIssueByCommentID :one
SELECT i.*
FROM issues i
JOIN issue_comments ic ON ic.issue_id = i.id
WHERE ic.id = $1;

-- name: IncrementIssueCommentCount :exec
UPDATE issues
SET comment_count = comment_count + 1,
    updated_at = NOW()
WHERE id = $1;

-- name: DecrementIssueCommentCount :exec
UPDATE issues
SET comment_count = GREATEST(comment_count - 1, 0),
    updated_at = NOW()
WHERE id = $1;

-- name: IncrementRepoIssueCount :exec
UPDATE repositories
SET num_issues = num_issues + 1,
    updated_at = NOW()
WHERE id = $1;

-- name: IncrementRepoClosedIssueCount :exec
UPDATE repositories
SET num_closed_issues = num_closed_issues + 1,
    updated_at = NOW()
WHERE id = $1;

-- name: DecrementRepoClosedIssueCount :exec
UPDATE repositories
SET num_closed_issues = GREATEST(num_closed_issues - 1, 0),
    updated_at = NOW()
WHERE id = $1;
