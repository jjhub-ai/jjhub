-- name: CreateLabel :one
INSERT INTO labels (repository_id, name, color, description)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: ListLabelsByRepo :many
SELECT *
FROM labels
WHERE repository_id = $1
ORDER BY id ASC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: ListAllLabelsByRepo :many
SELECT *
FROM labels
WHERE repository_id = $1
ORDER BY id ASC;

-- name: CountLabelsByRepo :one
SELECT COUNT(*)
FROM labels
WHERE repository_id = $1;

-- name: GetLabelByID :one
SELECT *
FROM labels
WHERE repository_id = $1
  AND id = $2;

-- name: GetLabelByName :one
SELECT *
FROM labels
WHERE repository_id = $1
  AND name = $2;

-- name: ListLabelsByNames :many
SELECT *
FROM labels
WHERE repository_id = sqlc.arg(repository_id)
  AND name = ANY(sqlc.arg(names)::text[])
ORDER BY id ASC;

-- name: UpdateLabel :one
UPDATE labels
SET name = $3,
    color = $4,
    description = $5,
    updated_at = NOW()
WHERE repository_id = $1
  AND id = $2
RETURNING *;

-- name: DeleteLabel :exec
DELETE FROM labels
WHERE repository_id = $1
  AND id = $2;

-- name: AddIssueLabel :one
INSERT INTO issue_labels (issue_id, label_id)
VALUES ($1, $2)
RETURNING *;

-- name: AddIssueLabels :exec
INSERT INTO issue_labels (issue_id, label_id)
SELECT sqlc.arg(issue_id), UNNEST(sqlc.arg(label_ids)::bigint[]);

-- name: RemoveIssueLabel :exec
DELETE FROM issue_labels
WHERE issue_id = $1
  AND label_id = $2;

-- name: RemoveIssueLabelByName :one
WITH removed AS (
	DELETE FROM issue_labels il
	USING issues i, labels l
	WHERE il.issue_id = i.id
	  AND il.label_id = l.id
	  AND i.repository_id = sqlc.arg(repository_id)
	  AND i.number = sqlc.arg(issue_number)
	  AND l.repository_id = sqlc.arg(repository_id)
	  AND l.name = sqlc.arg(label_name)
	RETURNING 1
)
SELECT COUNT(*)
FROM removed;

-- name: ListLabelsForIssue :many
SELECT l.*
FROM labels l
JOIN issue_labels il ON il.label_id = l.id
WHERE il.issue_id = $1
ORDER BY l.id ASC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: CountLabelsForIssue :one
SELECT COUNT(*)
FROM issue_labels
WHERE issue_id = $1;

-- name: CountIssueLabelsByLabel :one
SELECT COUNT(*)
FROM issue_labels
WHERE label_id = $1;
