-- name: GetWorkflowTaskForRunner :one
SELECT id, workflow_run_id, workflow_step_id, repository_id, runner_id, status
FROM workflow_tasks
WHERE id = sqlc.arg(task_id)
  AND status = 'running';

-- name: GetWorkflowTaskRuntimeContext :one
SELECT id, workflow_run_id, repository_id, status
FROM workflow_tasks
WHERE id = sqlc.arg(task_id)
  AND workflow_run_id = sqlc.arg(workflow_run_id)
  AND status IN ('assigned', 'running');

-- name: InsertWorkflowLog :one
INSERT INTO workflow_logs (workflow_run_id, workflow_step_id, sequence, stream, entry)
VALUES (
    sqlc.arg(workflow_run_id),
    sqlc.arg(workflow_step_id),
    sqlc.arg(sequence),
    sqlc.arg(stream),
    sqlc.arg(entry)
)
RETURNING *;

-- name: InsertWorkflowLogNextSequence :one
WITH step_lock AS (
    SELECT pg_advisory_xact_lock(sqlc.arg(workflow_step_id)) AS locked
),
next_sequence AS (
    SELECT COALESCE(MAX(sequence), 0)::bigint + 1 AS sequence
    FROM step_lock
    LEFT JOIN workflow_logs ON workflow_logs.workflow_step_id = sqlc.arg(workflow_step_id)
),
inserted AS (
    INSERT INTO workflow_logs (workflow_run_id, workflow_step_id, sequence, stream, entry)
    SELECT
        sqlc.arg(workflow_run_id),
        sqlc.arg(workflow_step_id),
        next_sequence.sequence,
        sqlc.arg(stream),
        sqlc.arg(entry)
    FROM step_lock, next_sequence
    RETURNING *
)
SELECT *
FROM inserted;

-- name: NotifyWorkflowLog :exec
SELECT pg_notify(
    'workflow_step_logs_' || sqlc.arg(step_id)::bigint::text,
    sqlc.arg(payload)::text
);

-- name: GetWorkflowRunByIDAndRepo :one
SELECT id, repository_id, workflow_definition_id, status, trigger_event, trigger_ref, trigger_commit_sha, agent_token_hash, agent_token_expires_at, started_at, completed_at, created_at, updated_at
FROM workflow_runs
WHERE id = sqlc.arg(run_id)
  AND repository_id = sqlc.arg(repository_id);

-- name: ListWorkflowStepsByRunID :many
SELECT id, workflow_run_id, name, position, status, started_at, completed_at, created_at, updated_at
FROM workflow_steps
WHERE workflow_run_id = sqlc.arg(run_id)
ORDER BY position;

-- name: ListWorkflowLogsSince :many
SELECT id, workflow_run_id, workflow_step_id, sequence, stream, entry, created_at
FROM workflow_logs
WHERE workflow_run_id = sqlc.arg(run_id)
  AND id > sqlc.arg(after_id)
ORDER BY id ASC
LIMIT sqlc.arg(page_size);
