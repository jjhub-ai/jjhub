-- name: CreateLandingRequest :one
INSERT INTO landing_requests (repository_id, number, title, body, author_id, target_bookmark, source_bookmark, state, stack_size)
VALUES ($1, get_next_landing_number($1), $2, $3, $4, $5, $6, 'open', $7)
RETURNING *;

-- name: GetLandingRequestByNumber :one
SELECT *
FROM landing_requests
WHERE repository_id = $1
  AND number = $2;

-- name: GetLandingRequestWithChangeIDsByNumber :one
SELECT
    lr.*,
    ARRAY(
        SELECT lrc.change_id::text
        FROM landing_request_changes AS lrc
        WHERE lrc.landing_request_id = lr.id
        ORDER BY lrc.position_in_stack
    )::text[] AS change_ids
FROM landing_requests AS lr
WHERE lr.repository_id = $1
  AND lr.number = $2;

-- name: AddLandingRequestChange :one
INSERT INTO landing_request_changes (landing_request_id, change_id, position_in_stack)
VALUES ($1, $2, $3)
RETURNING *;

-- name: DeleteLandingRequestChanges :exec
DELETE FROM landing_request_changes
WHERE landing_request_id = $1;

-- name: ListLandingRequestChanges :many
SELECT *
FROM landing_request_changes
WHERE landing_request_id = $1
ORDER BY position_in_stack ASC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: CreateLandingRequestReview :one
INSERT INTO landing_request_reviews (landing_request_id, reviewer_id, type, body)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: CreateLandingRequestComment :one
INSERT INTO landing_request_comments (landing_request_id, user_id, path, line, side, body)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: CountLandingRequestsByRepoFiltered :one
SELECT COUNT(*)
FROM landing_requests
WHERE repository_id = sqlc.arg(repository_id)
  AND (sqlc.arg(state)::text = '' OR state = sqlc.arg(state)::text);

-- name: ListLandingRequestsWithChangeIDsByRepoFiltered :many
SELECT
    lr.*,
    ARRAY(
        SELECT lrc.change_id::text
        FROM landing_request_changes AS lrc
        WHERE lrc.landing_request_id = lr.id
        ORDER BY lrc.position_in_stack
    )::text[] AS change_ids
FROM landing_requests AS lr
WHERE lr.repository_id = sqlc.arg(repository_id)
  AND (sqlc.arg(state)::text = '' OR lr.state = sqlc.arg(state)::text)
ORDER BY lr.number DESC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: UpdateLandingRequest :one
UPDATE landing_requests
SET title = sqlc.arg(title),
    body = sqlc.arg(body),
    state = sqlc.arg(state),
    target_bookmark = sqlc.arg(target_bookmark),
    source_bookmark = sqlc.arg(source_bookmark),
    conflict_status = sqlc.arg(conflict_status),
    stack_size = sqlc.arg(stack_size),
    closed_at = sqlc.arg(closed_at),
    merged_at = sqlc.arg(merged_at),
    updated_at = NOW()
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: MergeLandingRequest :one
UPDATE landing_requests
SET state = 'merged',
    merged_at = NOW(),
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: ListLandingRequestReviews :many
SELECT *
FROM landing_request_reviews
WHERE landing_request_id = $1
ORDER BY created_at ASC, id ASC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: CountLandingRequestReviews :one
SELECT COUNT(*)
FROM landing_request_reviews
WHERE landing_request_id = $1;

-- name: CountApprovedLandingRequestReviews :one
SELECT COUNT(DISTINCT reviewer_id)
FROM landing_request_reviews
WHERE landing_request_id = $1
  AND type = 'approve'
  AND state = 'submitted';

-- name: GetLandingRequestReviewByID :one
SELECT *
FROM landing_request_reviews
WHERE id = $1;

-- name: UpdateLandingRequestReviewState :one
UPDATE landing_request_reviews
SET state = sqlc.arg(state),
    updated_at = NOW()
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: ListLandingRequestComments :many
SELECT *
FROM landing_request_comments
WHERE landing_request_id = $1
ORDER BY created_at ASC, id ASC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: CountLandingRequestComments :one
SELECT COUNT(*)
FROM landing_request_comments
WHERE landing_request_id = $1;

-- name: CountLandingRequestChanges :one
SELECT COUNT(*)
FROM landing_request_changes
WHERE landing_request_id = $1;
-- tmpwatch

-- name: EnqueueLandingRequest :one
UPDATE landing_requests
SET state = 'queued',
    queued_by = sqlc.arg(queued_by),
    queued_at = NOW(),
    updated_at = NOW()
WHERE id = sqlc.arg(id)
  AND state = 'open'
RETURNING *;

-- name: CreateLandingTask :one
INSERT INTO landing_tasks (landing_request_id, repository_id, priority)
VALUES ($1, $2, $3)
RETURNING *;

-- name: ClaimPendingLandingTask :one
WITH claimable AS (
    SELECT lt.id
    FROM landing_tasks lt
    WHERE lt.status = 'pending'
      AND lt.available_at <= NOW()
      AND NOT EXISTS (
          SELECT 1 FROM landing_tasks lt2
          WHERE lt2.repository_id = lt.repository_id
            AND lt2.status = 'running'
      )
    ORDER BY lt.priority DESC, lt.created_at ASC, lt.id ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
UPDATE landing_tasks lt
SET status = 'running',
    attempt = lt.attempt + 1,
    started_at = NOW(),
    updated_at = NOW()
FROM claimable
WHERE lt.id = claimable.id
RETURNING lt.*;

-- name: MarkLandingTaskDone :one
UPDATE landing_tasks
SET status = 'done',
    finished_at = NOW(),
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: MarkLandingStarted :one
UPDATE landing_requests
SET state = 'landing',
    landing_started_at = NOW(),
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: FailLandingTask :one
UPDATE landing_tasks
SET status = 'failed',
    last_error = $2,
    finished_at = NOW(),
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: RevertLandingRequestToOpen :one
UPDATE landing_requests
SET state = 'open',
    queued_by = NULL,
    queued_at = NULL,
    landing_started_at = NULL,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetLandingTaskByLandingRequestID :one
SELECT *
FROM landing_tasks
WHERE landing_request_id = $1;

-- name: GetLandingRequestByID :one
SELECT *
FROM landing_requests
WHERE id = $1;

-- name: GetLandingQueuePositionByTaskID :one
SELECT COUNT(*) AS position
FROM landing_tasks AS t
WHERE t.status IN ('pending', 'running')
  AND t.repository_id = (SELECT lt.repository_id FROM landing_tasks AS lt WHERE lt.id = $1)
  AND t.created_at <= (SELECT lt2.created_at FROM landing_tasks AS lt2 WHERE lt2.id = $1);
