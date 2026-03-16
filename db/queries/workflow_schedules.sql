-- name: UpsertWorkflowScheduleSpec :exec
INSERT INTO workflow_schedule_specs (
    workflow_definition_id,
    repository_id,
    cron_expression,
    next_fire_at
)
VALUES ($1, $2, $3, $4)
ON CONFLICT (workflow_definition_id, cron_expression)
DO UPDATE SET
    repository_id = EXCLUDED.repository_id,
    next_fire_at = EXCLUDED.next_fire_at,
    updated_at = NOW();

-- name: DeleteWorkflowScheduleSpecsByDefinition :exec
DELETE FROM workflow_schedule_specs
WHERE workflow_definition_id = $1;

-- name: ClaimDueWorkflowScheduleSpecs :many
-- Atomically claim due schedule specs using FOR UPDATE SKIP LOCKED to prevent
-- concurrent pollers from double-firing the same spec. Sets next_fire_at to a
-- far-future sentinel so the spec is invisible to other pollers until the
-- caller computes and writes the real next fire time.
WITH claimable AS (
    SELECT id
    FROM workflow_schedule_specs
    WHERE next_fire_at <= NOW()
    ORDER BY next_fire_at ASC, id ASC
    FOR UPDATE SKIP LOCKED
    LIMIT sqlc.arg(limit_count)
)
UPDATE workflow_schedule_specs wss
SET prev_fire_at = NOW(),
    next_fire_at = '9999-12-31T23:59:59Z'::timestamptz,
    updated_at = NOW()
FROM claimable
WHERE wss.id = claimable.id
RETURNING wss.*;

-- name: UpdateWorkflowScheduleFireTimes :exec
UPDATE workflow_schedule_specs
SET prev_fire_at = $2,
    next_fire_at = $3,
    updated_at = NOW()
WHERE id = $1;

