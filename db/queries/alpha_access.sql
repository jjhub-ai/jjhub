-- name: AddWhitelistEntry :one
INSERT INTO alpha_whitelist_entries (
    identity_type,
    identity_value,
    lower_identity_value,
    created_by
)
VALUES (
    sqlc.arg(identity_type),
    sqlc.arg(identity_value),
    sqlc.arg(lower_identity_value),
    sqlc.arg(created_by)
)
ON CONFLICT (identity_type, lower_identity_value)
DO UPDATE SET
    identity_value = EXCLUDED.identity_value,
    created_by = EXCLUDED.created_by,
    updated_at = NOW()
RETURNING *;

-- name: RemoveWhitelistEntry :execrows
DELETE FROM alpha_whitelist_entries
WHERE identity_type = sqlc.arg(identity_type)
  AND lower_identity_value = sqlc.arg(lower_identity_value);

-- name: ListWhitelistEntries :many
SELECT *
FROM alpha_whitelist_entries
ORDER BY created_at DESC;

-- name: IsWhitelistedIdentity :one
SELECT EXISTS (
    SELECT 1
    FROM alpha_whitelist_entries
    WHERE identity_type = sqlc.arg(identity_type)
      AND lower_identity_value = sqlc.arg(lower_identity_value)
);

-- name: UpsertWaitlistEntry :one
INSERT INTO alpha_waitlist_entries (email, lower_email, note, source)
VALUES (
    sqlc.arg(email),
    sqlc.arg(lower_email),
    sqlc.arg(note),
    sqlc.arg(source)
)
ON CONFLICT (lower_email)
DO UPDATE SET
    email = EXCLUDED.email,
    note = CASE
        WHEN EXCLUDED.note = '' THEN alpha_waitlist_entries.note
        ELSE EXCLUDED.note
    END,
    source = EXCLUDED.source,
    status = CASE
        WHEN alpha_waitlist_entries.status = 'approved' THEN alpha_waitlist_entries.status
        ELSE 'pending'
    END,
    approved_by = CASE
        WHEN alpha_waitlist_entries.status = 'approved' THEN alpha_waitlist_entries.approved_by
        ELSE NULL
    END,
    approved_at = CASE
        WHEN alpha_waitlist_entries.status = 'approved' THEN alpha_waitlist_entries.approved_at
        ELSE NULL
    END,
    updated_at = NOW()
RETURNING *;

-- name: GetWaitlistEntryByLowerEmail :one
SELECT *
FROM alpha_waitlist_entries
WHERE lower_email = sqlc.arg(lower_email);

-- name: ListWaitlistEntries :many
SELECT *
FROM alpha_waitlist_entries
WHERE (
    sqlc.arg(status_filter)::text = ''
    OR status = sqlc.arg(status_filter)
)
ORDER BY created_at DESC
LIMIT sqlc.arg(page_size)
OFFSET sqlc.arg(page_offset);

-- name: CountWaitlistEntries :one
SELECT COUNT(*)
FROM alpha_waitlist_entries
WHERE (
    sqlc.arg(status_filter)::text = ''
    OR status = sqlc.arg(status_filter)
);

-- name: ApproveWaitlistEntryByLowerEmail :one
UPDATE alpha_waitlist_entries
SET status = 'approved',
    approved_by = sqlc.arg(approved_by),
    approved_at = NOW(),
    updated_at = NOW()
WHERE lower_email = sqlc.arg(lower_email)
RETURNING *;
