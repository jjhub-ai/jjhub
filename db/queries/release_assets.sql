-- name: CreateReleaseAsset :one
WITH next_asset AS (
    SELECT nextval(pg_get_serial_sequence('release_assets', 'id')) AS id
)
INSERT INTO release_assets (
    id,
    release_id,
    uploader_id,
    name,
    size,
    download_count,
    status,
    gcs_key,
    content_type
)
SELECT
    next_asset.id,
    sqlc.arg(release_id),
    sqlc.arg(uploader_id),
    sqlc.arg(name),
    sqlc.arg(size),
    0,
    'pending',
    format(
        'repos/%s/releases/%s/assets/%s/%s',
        sqlc.arg(repository_id)::text,
        sqlc.arg(release_id)::text,
        next_asset.id::text,
        sqlc.arg(name)
    ),
    sqlc.arg(content_type)
FROM next_asset
RETURNING
    id,
    release_id,
    uploader_id,
    name,
    size,
    download_count,
    status,
    gcs_key,
    content_type,
    confirmed_at,
    created_at,
    updated_at;

-- name: GetReleaseAssetByID :one
SELECT
    id,
    release_id,
    uploader_id,
    name,
    size,
    download_count,
    status,
    gcs_key,
    content_type,
    confirmed_at,
    created_at,
    updated_at
FROM release_assets
WHERE release_id = sqlc.arg(release_id)
  AND id = sqlc.arg(id);

-- name: ListReleaseAssets :many
SELECT
    id,
    release_id,
    uploader_id,
    name,
    size,
    download_count,
    status,
    gcs_key,
    content_type,
    confirmed_at,
    created_at,
    updated_at
FROM release_assets
WHERE release_id = $1
ORDER BY created_at DESC, id DESC;

-- name: CountReleaseAssets :one
SELECT COUNT(*)
FROM release_assets
WHERE release_id = $1;

-- name: UpdateReleaseAsset :one
UPDATE release_assets
SET name = sqlc.arg(name),
    updated_at = NOW()
WHERE release_id = sqlc.arg(release_id)
  AND id = sqlc.arg(id)
RETURNING
    id,
    release_id,
    uploader_id,
    name,
    size,
    download_count,
    status,
    gcs_key,
    content_type,
    confirmed_at,
    created_at,
    updated_at;

-- name: ConfirmReleaseAssetUpload :one
UPDATE release_assets
SET status = 'ready',
    confirmed_at = COALESCE(confirmed_at, NOW()),
    updated_at = NOW()
WHERE release_id = sqlc.arg(release_id)
  AND id = sqlc.arg(id)
RETURNING
    id,
    release_id,
    uploader_id,
    name,
    size,
    download_count,
    status,
    gcs_key,
    content_type,
    confirmed_at,
    created_at,
    updated_at;

-- name: IncrementReleaseAssetDownloadCount :exec
UPDATE release_assets
SET download_count = download_count + 1,
    updated_at = NOW()
WHERE release_id = sqlc.arg(release_id)
  AND id = sqlc.arg(id);

-- name: DeleteReleaseAsset :one
DELETE FROM release_assets
WHERE release_id = sqlc.arg(release_id)
  AND id = sqlc.arg(id)
RETURNING
    id,
    release_id,
    uploader_id,
    name,
    size,
    download_count,
    status,
    gcs_key,
    content_type,
    confirmed_at,
    created_at,
    updated_at;
