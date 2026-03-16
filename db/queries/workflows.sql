-- name: CreateWorkflowDefinition :one
INSERT INTO workflow_definitions (repository_id, name, path, config)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: ListBlockedTasksForRun :many
SELECT wt.id, wt.payload, ws.name as step_name
FROM workflow_tasks wt
JOIN workflow_steps ws ON ws.id = wt.workflow_step_id
WHERE wt.workflow_run_id = $1
  AND wt.status = 'blocked';

-- name: ListTaskStepInfoForRun :many
SELECT wt.id, wt.status, ws.name as step_name
FROM workflow_tasks wt
JOIN workflow_steps ws ON ws.id = wt.workflow_step_id
WHERE wt.workflow_run_id = $1;

-- name: UnblockWorkflowTask :exec
UPDATE workflow_tasks
SET status = 'pending',
    available_at = NOW(),
    updated_at = NOW()
WHERE id = $1
  AND status = 'blocked';

-- name: SkipBlockedWorkflowTask :exec
UPDATE workflow_tasks
SET status = 'skipped',
    finished_at = NOW(),
    updated_at = NOW()
WHERE id = $1
  AND status = 'blocked';

-- name: UpsertWorkflowDefinition :one
INSERT INTO workflow_definitions (repository_id, name, path, config, is_active)
VALUES ($1, $2, $3, $4, TRUE)
ON CONFLICT (repository_id, path)
DO UPDATE SET
  name = EXCLUDED.name,
  config = EXCLUDED.config,
  is_active = TRUE,
  updated_at = NOW()
RETURNING *;

-- name: DeactivateWorkflowDefinitionByPath :exec
UPDATE workflow_definitions
SET is_active = FALSE,
    updated_at = NOW()
WHERE repository_id = $1
  AND path = $2;

-- name: EnsureWorkflowDefinitionReference :one
INSERT INTO workflow_definitions (repository_id, name, path, config, is_active)
VALUES ($1, $2, $3, $4, FALSE)
ON CONFLICT (repository_id, path)
DO UPDATE SET
  updated_at = NOW()
RETURNING *;

-- name: UpsertAgentWorkflowDefinition :one
-- Creates or returns the per-repo agent workflow definition.
-- Uses the UNIQUE(repository_id, path) constraint for idempotent upserts.
-- The sentinel path '.jjhub/agent' identifies agent workflow definitions.
INSERT INTO workflow_definitions (repository_id, name, path, config)
VALUES (sqlc.arg(repository_id), 'Agent', '.jjhub/agent', '{"agent": true}'::jsonb)
ON CONFLICT (repository_id, path) DO UPDATE SET updated_at = NOW()
RETURNING *;

-- name: GetWorkflowDefinition :one
SELECT *
FROM workflow_definitions
WHERE id = $1
  AND repository_id = $2;

-- name: GetWorkflowDefinitionByPath :one
SELECT *
FROM workflow_definitions
WHERE repository_id = $1
  AND path = $2;

-- name: GetWorkflowRun :one
SELECT *
FROM workflow_runs
WHERE id = $1
  AND repository_id = $2;

-- name: GetWorkflowRunByRunID :one
SELECT *
FROM workflow_runs
WHERE id = $1;

-- name: ListWorkflowRunsByDefinition :many
SELECT *
FROM workflow_runs
WHERE workflow_definition_id = $1
  AND repository_id = $2
ORDER BY id DESC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: ListWorkflowDefinitionsByRepo :many
SELECT *
FROM workflow_definitions
WHERE repository_id = $1
ORDER BY id DESC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: CreateWorkflowRun :one
INSERT INTO workflow_runs (repository_id, workflow_definition_id, status, trigger_event, trigger_ref, trigger_commit_sha, dispatch_inputs)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: ListWorkflowRunsByRepo :many
SELECT *
FROM workflow_runs
WHERE repository_id = $1
ORDER BY id DESC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: CreateWorkflowStep :one
INSERT INTO workflow_steps (workflow_run_id, name, position, status)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: CreateWorkflowTask :one
INSERT INTO workflow_tasks (workflow_run_id, workflow_step_id, repository_id, status, priority, payload, available_at, vm_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetClaimableWorkflowTaskBacklog :one
SELECT
    COUNT(*)::bigint AS depth,
    COALESCE(EXTRACT(EPOCH FROM NOW() - MIN(available_at)), 0)::double precision AS oldest_age_seconds
FROM workflow_tasks
WHERE status = 'pending'
  AND available_at <= NOW();

-- name: MarkWorkflowTaskVMRunning :execrows
UPDATE workflow_tasks
SET status = 'running',
    vm_id = sqlc.arg(vm_id),
    started_at = COALESCE(started_at, NOW()),
    updated_at = NOW()
WHERE id = sqlc.arg(id)
  AND status IN ('pending', 'assigned');

-- name: ClaimPendingTask :one
WITH claimed AS (
    SELECT id
    FROM workflow_tasks
    WHERE status = 'pending'
      AND available_at <= NOW()
    ORDER BY priority DESC, created_at ASC, id ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
UPDATE workflow_tasks wt
SET status = 'assigned',
    attempt = wt.attempt + 1,
    runner_id = sqlc.arg(runner_id),
    assigned_at = NOW(),
    updated_at = NOW()
FROM claimed
WHERE wt.id = claimed.id
RETURNING wt.*;

-- name: MarkWorkflowTaskRunning :execrows
UPDATE workflow_tasks
SET status = 'running',
    started_at = COALESCE(started_at, NOW()),
    updated_at = NOW()
WHERE id = $1
  AND runner_id = $2
  AND status = 'assigned';

-- name: GetWorkflowTaskStepID :one
SELECT workflow_step_id FROM workflow_tasks WHERE id = $1;

-- name: UpdateWorkflowStepStatusRunning :execrows
UPDATE workflow_steps
SET status = 'running',
    started_at = COALESCE(workflow_steps.started_at, NOW()),
    updated_at = NOW()
WHERE workflow_steps.id = @step_id;

-- name: UpdateWorkflowStepStatusTerminal :execrows
UPDATE workflow_steps
SET status = @status,
    completed_at = NOW(),
    updated_at = NOW()
WHERE workflow_steps.id = @step_id;

-- name: MarkWorkflowTaskDone :one
UPDATE workflow_tasks
SET status = $3,
    last_error = $4,
    finished_at = NOW(),
    updated_at = NOW()
WHERE id = $1
  AND runner_id = $2
  AND status = 'running'
  AND $3 IN ('done', 'failed', 'cancelled')
RETURNING workflow_run_id;

-- name: MarkWorkflowTaskTerminalByID :one
UPDATE workflow_tasks
SET status = sqlc.arg(status),
    last_error = sqlc.arg(last_error),
    finished_at = NOW(),
    updated_at = NOW()
WHERE id = sqlc.arg(id)
  AND status IN ('pending', 'assigned', 'running')
  AND sqlc.arg(status) IN ('done', 'failed', 'cancelled')
RETURNING workflow_run_id;

-- name: GetWorkflowTaskByRunID :one
SELECT *
FROM workflow_tasks
WHERE workflow_run_id = $1
ORDER BY id DESC
LIMIT 1;

-- name: RequeueTasksForRunner :one
WITH affected AS (
    SELECT id, workflow_step_id, status
    FROM workflow_tasks
    WHERE workflow_tasks.runner_id = sqlc.arg(runner_id)
      AND workflow_tasks.status IN ('assigned', 'running')
    FOR UPDATE
),
requeued AS (
    UPDATE workflow_tasks wt
    SET status = 'pending',
        runner_id = NULL,
        assigned_at = NULL,
        started_at = NULL,
        available_at = NOW() + (
            INTERVAL '1 second' * LEAST(
                300,
                POWER(2, LEAST(GREATEST(wt.attempt - 1, 0), 9))
            )
        ),
        updated_at = NOW()
    FROM affected
    WHERE wt.id = affected.id
    RETURNING affected.workflow_step_id, affected.status
),
reset_steps AS (
    UPDATE workflow_steps ws
    SET status = 'queued',
        started_at = NULL,
        completed_at = NULL,
        updated_at = NOW()
    WHERE ws.id IN (
        SELECT workflow_step_id
        FROM requeued
        WHERE status = 'running'
    )
      AND ws.status = 'running'
    RETURNING ws.id
)
SELECT COUNT(*)::bigint
FROM requeued;

-- name: UpdateWorkflowRunStatusBasedOnTasks :one
-- Derive aggregate run status from its tasks and update workflow_runs.
-- Returns the new status. Returns no rows if no matching run exists.
WITH task_summary AS (
    SELECT
        workflow_run_id,
        COUNT(*) FILTER (WHERE status IN ('pending', 'assigned', 'running', 'blocked')) AS active,
        COUNT(*) FILTER (WHERE status = 'failed')                            AS failed,
        COUNT(*) FILTER (WHERE status = 'cancelled')                         AS cancelled,
        COUNT(*) FILTER (WHERE status IN ('done', 'skipped'))                AS done,
        COUNT(*)                                                              AS total
    FROM workflow_tasks
    WHERE workflow_run_id = $1
    GROUP BY workflow_run_id
),
derived AS (
    SELECT
        CASE
            WHEN active > 0                   THEN 'running'
            WHEN failed > 0                   THEN 'failure'
            WHEN cancelled > 0 AND done = 0   THEN 'cancelled'
            WHEN done = total AND total > 0    THEN 'success'
            ELSE 'failure'
        END AS new_status
    FROM task_summary
)
UPDATE workflow_runs wr
SET status       = derived.new_status,
    completed_at = CASE WHEN derived.new_status IN ('success', 'failure', 'cancelled') THEN NOW() ELSE completed_at END,
    started_at   = COALESCE(started_at, NOW()),
    updated_at   = NOW()
FROM derived
WHERE wr.id = $1
RETURNING wr.status;

-- name: NotifyWorkflowRunEvent :exec
SELECT pg_notify(
    'workflow_run_events_' || sqlc.arg(run_id)::bigint::text,
    sqlc.arg(payload)::text
);

-- name: GetWorkflowTask :one
SELECT *
FROM workflow_tasks
WHERE id = sqlc.arg(id)
  AND repository_id = sqlc.arg(repository_id);

-- name: CancelWorkflowRun :exec
UPDATE workflow_runs
SET status = 'cancelled',
    completed_at = NOW(),
    updated_at = NOW()
WHERE id = $1
  AND status NOT IN ('success', 'failure', 'cancelled');

-- name: CancelWorkflowTasks :exec
UPDATE workflow_tasks
SET status = 'cancelled',
    finished_at = NOW(),
    updated_at = NOW()
WHERE workflow_run_id = $1
  AND status IN ('pending', 'assigned', 'running', 'blocked');

-- name: ResumeWorkflowRun :exec
UPDATE workflow_runs
SET status = 'queued',
    completed_at = NULL,
    updated_at = NOW()
WHERE id = $1
  AND status IN ('cancelled', 'failure');

-- name: ResumeWorkflowTasks :exec
UPDATE workflow_tasks
SET status = 'pending',
    runner_id = NULL,
    assigned_at = NULL,
    started_at = NULL,
    finished_at = NULL,
    last_error = NULL,
    available_at = NOW(),
    updated_at = NOW()
WHERE workflow_run_id = $1
  AND status IN ('cancelled', 'failed');

-- name: ResumeWorkflowSteps :exec
UPDATE workflow_steps
SET status = 'queued',
    started_at = NULL,
    completed_at = NULL,
    updated_at = NOW()
WHERE workflow_run_id = $1
  AND status IN ('cancelled', 'failure');

-- name: CreateCommitStatus :one
INSERT INTO commit_statuses (repository_id, change_id, commit_sha, context, status, description, target_url, workflow_run_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: UpdateLatestCommitStatusByWorkflowRunID :one
UPDATE commit_statuses
SET status = $2,
    description = $3,
    target_url = $4,
    updated_at = NOW()
WHERE id = (
  SELECT cs.id
  FROM commit_statuses cs
  WHERE cs.workflow_run_id = $1
  ORDER BY cs.id DESC
  LIMIT 1
)
RETURNING *;

-- name: ListCommitStatusesByRef :many
SELECT *
FROM commit_statuses
WHERE repository_id = $1
  AND (change_id = sqlc.arg(ref) OR commit_sha = sqlc.arg(ref))
ORDER BY created_at DESC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: ListCommitStatusesBySHA :many
SELECT *
FROM commit_statuses
WHERE repository_id = $1
  AND commit_sha = $2
ORDER BY created_at DESC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: CountCommitStatusesByRef :one
SELECT COUNT(*)
FROM commit_statuses
WHERE repository_id = $1
  AND (change_id = sqlc.arg(ref) OR commit_sha = sqlc.arg(ref));

-- name: GetLatestCommitStatusBySHA :one
SELECT *
FROM commit_statuses
WHERE repository_id = $1
  AND commit_sha = $2
ORDER BY created_at DESC
LIMIT 1;

-- name: ListLatestCanaryStepStatuses :many
WITH latest_run AS (
    SELECT wr.id
    FROM workflow_runs wr
    JOIN workflow_definitions wd ON wd.id = wr.workflow_definition_id
    WHERE wd.path = sqlc.arg(workflow_path)
      AND wr.completed_at IS NOT NULL
    ORDER BY wr.completed_at DESC, wr.id DESC
    LIMIT 1
)
SELECT ws.name, ws.status
FROM latest_run lr
JOIN workflow_steps ws ON ws.workflow_run_id = lr.id
WHERE ws.name LIKE 'canary-%'
ORDER BY ws.position ASC, ws.id ASC;

-- name: GetLatestCommitStatusesByChangeIDsAndContexts :many
-- Returns the latest commit status per context for a set of change IDs.
-- Used to enforce required status checks before landing.
SELECT DISTINCT ON (cs.context)
    cs.context,
    cs.status,
    cs.created_at
FROM commit_statuses cs
WHERE cs.repository_id = @repository_id
  AND cs.change_id = ANY(@change_ids::text[])
  AND cs.context = ANY(@contexts::text[])
ORDER BY cs.context, cs.created_at DESC;
