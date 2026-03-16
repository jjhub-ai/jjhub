-- name: CreateAgentSession :one
INSERT INTO agent_sessions (id, repository_id, user_id, title, status)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetAgentSession :one
SELECT *
FROM agent_sessions
WHERE id = $1;

-- name: ListAgentSessionsByRepo :many
SELECT *
FROM agent_sessions
WHERE repository_id = $1
ORDER BY created_at DESC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: CountAgentSessionsByRepo :one
SELECT COUNT(*) FROM agent_sessions WHERE repository_id = $1;

-- name: UpdateAgentSessionStatus :one
UPDATE agent_sessions
SET status = $2, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateAgentSessionStartedAt :one
UPDATE agent_sessions
SET started_at = COALESCE(started_at, $2), updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateAgentSessionTerminalStatus :one
UPDATE agent_sessions
SET status = $2, finished_at = $3, updated_at = NOW()
WHERE id = $1 AND status = 'active'
RETURNING *;

-- name: UpdateAgentSessionTimedOut :one
UPDATE agent_sessions
SET status = 'timed_out', finished_at = $2, updated_at = NOW()
WHERE id = $1 AND status = 'active'
RETURNING *;

-- name: LockAgentSessionForAppend :one
-- Locks the agent session row for update to prevent race conditions.
SELECT id FROM agent_sessions WHERE id = $1 FOR UPDATE;

-- name: UpdateAgentSessionWorkflowRun :one
-- Updates the workflow_run_id on an agent session.
UPDATE agent_sessions
SET workflow_run_id = $1, updated_at = NOW()
WHERE id = $2
RETURNING *;

-- name: DeleteAgentSession :exec
DELETE FROM agent_sessions WHERE id = $1 AND user_id = $2;

-- name: CreateAgentMessage :one
INSERT INTO agent_messages (session_id, role, sequence)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetNextAgentMessageSequence :one
SELECT COALESCE(MAX(sequence), -1) + 1 AS next_seq
FROM agent_messages
WHERE session_id = $1;

-- name: CreateAgentMessageWithNextSequence :one
-- Atomically locks the session row, computes the next sequence, and inserts the message.
-- This prevents race conditions when concurrent appends target the same session.
WITH locked_session AS (
    SELECT agent_sessions.id
    FROM agent_sessions
    WHERE agent_sessions.id = sqlc.arg(session_id)
    FOR UPDATE
)
INSERT INTO agent_messages (session_id, role, sequence)
SELECT
    ls.id,
    sqlc.arg(role),
    COALESCE((SELECT MAX(sequence) FROM agent_messages WHERE session_id = ls.id), -1) + 1
FROM locked_session ls
RETURNING *;

-- name: CreateAgentPart :one
INSERT INTO agent_parts (message_id, part_index, part_type, content)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: ListAgentMessageParts :many
SELECT *
FROM agent_parts
WHERE message_id = $1
ORDER BY part_index ASC;

-- name: ListAgentMessages :many
SELECT *
FROM agent_messages
WHERE session_id = $1
ORDER BY sequence ASC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: GetAgentSessionWorkflowRunID :one
SELECT workflow_run_id FROM agent_sessions WHERE id = $1;

-- name: ListStaleActiveSessions :many
SELECT *
FROM agent_sessions
WHERE status = 'active'
  AND started_at IS NOT NULL
  AND started_at < $1
ORDER BY started_at ASC;

-- name: NotifyAgentMessage :exec
-- Sends a pg_notify on the agent_session_{session_id_no_dashes} channel.
-- Called after inserting an agent message so SSE subscribers receive the event.
SELECT pg_notify(
    'agent_session_' || replace(sqlc.arg(session_id)::text, '-', ''),
    sqlc.arg(payload)::text
);

-- name: CountAgentMessagesBySession :one
SELECT COUNT(*) FROM agent_messages WHERE session_id = $1;

-- name: ListAgentSessionsByRepoWithMessageCount :many
-- Lists sessions enriched with message_count for list/detail views.
SELECT
    s.id,
    s.repository_id,
    s.user_id,
    s.workflow_run_id,
    s.title,
    s.status,
    s.started_at,
    s.finished_at,
    s.created_at,
    s.updated_at,
    COALESCE(mc.cnt, 0)::bigint AS message_count
FROM agent_sessions s
LEFT JOIN (
    SELECT session_id, COUNT(*) AS cnt
    FROM agent_messages
    GROUP BY session_id
) mc ON mc.session_id = s.id
WHERE s.repository_id = $1
ORDER BY s.created_at DESC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: GetAgentSessionWithMessageCount :one
-- Returns a single session enriched with message_count.
SELECT
    s.id,
    s.repository_id,
    s.user_id,
    s.workflow_run_id,
    s.title,
    s.status,
    s.started_at,
    s.finished_at,
    s.created_at,
    s.updated_at,
    COALESCE(mc.cnt, 0)::bigint AS message_count
FROM agent_sessions s
LEFT JOIN (
    SELECT session_id, COUNT(*) AS cnt
    FROM agent_messages
    GROUP BY session_id
) mc ON mc.session_id = s.id
WHERE s.id = $1;

-- name: NotifyAgentSession :exec
-- Sends a pg_notify on the agent_session_{session_id} channel for session-level events.
-- session_id must already have dashes stripped by the caller.
SELECT pg_notify(
    'agent_session_' || sqlc.arg(session_id)::text,
    sqlc.arg(payload)::text
);

-- name: ListAgentMessagesAfterID :many
-- Returns messages with id > after_id for a given session, ordered ascending.
-- Used by the SSE handler to replay missed events on reconnection.
SELECT id, session_id, role, sequence, created_at
FROM agent_messages
WHERE session_id = $1 AND id > @after_id
ORDER BY id ASC
LIMIT @max_results;
