-- name: CreateRelease :one
INSERT INTO releases (
    repository_id,
    publisher_id,
    tag_name,
    target,
    title,
    body,
    sha,
    is_draft,
    is_prerelease,
    is_tag,
    published_at
)
VALUES (
    sqlc.arg(repository_id),
    sqlc.arg(publisher_id),
    sqlc.arg(tag_name),
    sqlc.arg(target),
    sqlc.arg(title),
    sqlc.arg(body),
    sqlc.arg(sha),
    sqlc.arg(is_draft),
    sqlc.arg(is_prerelease),
    sqlc.arg(is_tag),
    sqlc.arg(published_at)
)
RETURNING
    id,
    repository_id,
    publisher_id,
    tag_name,
    target,
    title,
    body,
    sha,
    is_draft,
    is_prerelease,
    is_tag,
    published_at,
    created_at,
    updated_at;

-- name: GetReleaseByID :one
SELECT
    id,
    repository_id,
    publisher_id,
    tag_name,
    target,
    title,
    body,
    sha,
    is_draft,
    is_prerelease,
    is_tag,
    published_at,
    created_at,
    updated_at
FROM releases
WHERE repository_id = sqlc.arg(repository_id)
  AND id = sqlc.arg(id);

-- name: GetReleaseByTag :one
SELECT
    id,
    repository_id,
    publisher_id,
    tag_name,
    target,
    title,
    body,
    sha,
    is_draft,
    is_prerelease,
    is_tag,
    published_at,
    created_at,
    updated_at
FROM releases
WHERE repository_id = sqlc.arg(repository_id)
  AND tag_name = sqlc.arg(tag_name);

-- name: GetLatestRelease :one
SELECT
    id,
    repository_id,
    publisher_id,
    tag_name,
    target,
    title,
    body,
    sha,
    is_draft,
    is_prerelease,
    is_tag,
    published_at,
    created_at,
    updated_at
FROM releases
WHERE repository_id = $1
  AND is_draft = FALSE
  AND is_prerelease = FALSE
ORDER BY COALESCE(published_at, created_at) DESC, id DESC
LIMIT 1;

-- name: ListReleases :many
SELECT
    id,
    repository_id,
    publisher_id,
    tag_name,
    target,
    title,
    body,
    sha,
    is_draft,
    is_prerelease,
    is_tag,
    published_at,
    created_at,
    updated_at
FROM releases
WHERE repository_id = sqlc.arg(repository_id)
  AND (NOT sqlc.arg(exclude_drafts)::bool OR is_draft = FALSE)
  AND (NOT sqlc.arg(exclude_prereleases)::bool OR is_prerelease = FALSE)
ORDER BY COALESCE(published_at, created_at) DESC, id DESC
LIMIT sqlc.arg(page_size) OFFSET sqlc.arg(page_offset);

-- name: CountReleasesByRepo :one
SELECT COUNT(*)
FROM releases
WHERE repository_id = sqlc.arg(repository_id)
  AND (NOT sqlc.arg(exclude_drafts)::bool OR is_draft = FALSE)
  AND (NOT sqlc.arg(exclude_prereleases)::bool OR is_prerelease = FALSE);

-- name: UpdateRelease :one
UPDATE releases
SET tag_name = sqlc.arg(tag_name),
    target = sqlc.arg(target),
    title = sqlc.arg(title),
    body = sqlc.arg(body),
    sha = sqlc.arg(sha),
    is_draft = sqlc.arg(is_draft),
    is_prerelease = sqlc.arg(is_prerelease),
    is_tag = sqlc.arg(is_tag),
    published_at = sqlc.arg(published_at),
    updated_at = NOW()
WHERE repository_id = sqlc.arg(repository_id)
  AND id = sqlc.arg(id)
RETURNING
    id,
    repository_id,
    publisher_id,
    tag_name,
    target,
    title,
    body,
    sha,
    is_draft,
    is_prerelease,
    is_tag,
    published_at,
    created_at,
    updated_at;

-- name: DeleteRelease :one
DELETE FROM releases
WHERE repository_id = sqlc.arg(repository_id)
  AND id = sqlc.arg(id)
RETURNING
    id,
    repository_id,
    publisher_id,
    tag_name,
    target,
    title,
    body,
    sha,
    is_draft,
    is_prerelease,
    is_tag,
    published_at,
    created_at,
    updated_at;

-- name: DeleteReleaseByTag :one
DELETE FROM releases
WHERE repository_id = sqlc.arg(repository_id)
  AND tag_name = sqlc.arg(tag_name)
RETURNING
    id,
    repository_id,
    publisher_id,
    tag_name,
    target,
    title,
    body,
    sha,
    is_draft,
    is_prerelease,
    is_tag,
    published_at,
    created_at,
    updated_at;

-- name: NotifyReleaseEvent :exec
SELECT pg_notify(
    'release_' || sqlc.arg(repository_id)::bigint::text,
    sqlc.arg(payload)::text
);
