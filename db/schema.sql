-- JJHub MVP schema
-- Core domain schema for auth, repositories, issues, landing requests,
-- workflows, notifications, webhooks, and agent sessions.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    username        VARCHAR(255) NOT NULL UNIQUE,
    lower_username  VARCHAR(255) NOT NULL UNIQUE,
    email           VARCHAR(255),
    lower_email     VARCHAR(255),
    display_name    VARCHAR(255) NOT NULL DEFAULT '',
    bio             TEXT NOT NULL DEFAULT '',
    search_vector   TSVECTOR,
    avatar_url      VARCHAR(2048) NOT NULL DEFAULT '',
    wallet_address  VARCHAR(42),
    user_type       VARCHAR(32) NOT NULL DEFAULT 'user' CHECK (user_type IN ('user', 'bot', 'service')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_admin        BOOLEAN NOT NULL DEFAULT FALSE,
    prohibit_login  BOOLEAN NOT NULL DEFAULT FALSE,
    email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_lower_username ON users (lower_username);
CREATE UNIQUE INDEX uq_users_lower_email ON users (lower_email) WHERE lower_email IS NOT NULL;
CREATE UNIQUE INDEX uq_users_wallet_address ON users (wallet_address) WHERE wallet_address IS NOT NULL;
CREATE INDEX idx_users_search_vector_gin ON users USING GIN (search_vector);

-- Closed alpha access control
CREATE TABLE IF NOT EXISTS alpha_whitelist_entries (
    id                   BIGSERIAL PRIMARY KEY,
    identity_type        VARCHAR(16) NOT NULL CHECK (identity_type IN ('email', 'wallet', 'username')),
    identity_value       VARCHAR(255) NOT NULL,
    lower_identity_value VARCHAR(255) NOT NULL,
    created_by           BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (identity_type, lower_identity_value)
);

CREATE INDEX idx_alpha_whitelist_created_by ON alpha_whitelist_entries (created_by);

CREATE TABLE IF NOT EXISTS alpha_waitlist_entries (
    id          BIGSERIAL PRIMARY KEY,
    email       VARCHAR(255) NOT NULL,
    lower_email VARCHAR(255) NOT NULL UNIQUE,
    note        TEXT NOT NULL DEFAULT '',
    status      VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    source      VARCHAR(32) NOT NULL DEFAULT 'unknown',
    approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alpha_waitlist_status_created ON alpha_waitlist_entries (status, created_at DESC);
CREATE INDEX idx_alpha_waitlist_approved_by ON alpha_waitlist_entries (approved_by);

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    lower_name    VARCHAR(255) NOT NULL UNIQUE,
    description   TEXT NOT NULL DEFAULT '',
    visibility    VARCHAR(16) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'limited', 'private')),
    website       VARCHAR(2048) NOT NULL DEFAULT '',
    location      VARCHAR(255) NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_lower_name ON organizations (lower_name);

-- Authentication sessions
CREATE TABLE IF NOT EXISTS auth_sessions (
    session_key   UUID PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username      VARCHAR(255) NOT NULL,
    is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
    data          BYTEA,
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_sessions_user_id ON auth_sessions (user_id);
CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions (expires_at);

-- Auth nonces (Sign in with Key)
CREATE TABLE IF NOT EXISTS auth_nonces (
    nonce_key       VARCHAR(64) PRIMARY KEY,
    wallet_address  VARCHAR(42),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    used_at         TIMESTAMPTZ
);

CREATE INDEX idx_auth_nonces_expires_at ON auth_nonces (expires_at);
CREATE INDEX idx_auth_nonces_wallet ON auth_nonces (wallet_address);

-- OAuth states
CREATE TABLE IF NOT EXISTS oauth_states (
    state_key       VARCHAR(64) PRIMARY KEY,
    context_hash    VARCHAR(64) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    used_at         TIMESTAMPTZ
);

CREATE INDEX idx_oauth_states_expires_at ON oauth_states (expires_at);

-- One-time pending Linear OAuth setup payloads.
CREATE TABLE IF NOT EXISTS linear_oauth_setups (
    setup_key         VARCHAR(64) PRIMARY KEY,
    user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payload_encrypted BYTEA NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at        TIMESTAMPTZ NOT NULL,
    used_at           TIMESTAMPTZ
);

CREATE INDEX idx_linear_oauth_setups_user_id ON linear_oauth_setups (user_id);
CREATE INDEX idx_linear_oauth_setups_expires_at ON linear_oauth_setups (expires_at);

-- User email addresses
CREATE TABLE IF NOT EXISTS email_addresses (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email          VARCHAR(255) NOT NULL,
    lower_email    VARCHAR(255) NOT NULL,
    is_activated   BOOLEAN NOT NULL DEFAULT FALSE,
    is_primary     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, lower_email),
    UNIQUE (lower_email)
);

CREATE INDEX idx_email_addresses_user_id ON email_addresses (user_id);
CREATE UNIQUE INDEX uq_email_addresses_primary_per_user
    ON email_addresses (user_id)
    WHERE is_primary = TRUE;

-- Email verification / reset tokens
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email         VARCHAR(255) NOT NULL,
    token_hash    VARCHAR(64) NOT NULL UNIQUE,
    token_type    VARCHAR(20) NOT NULL CHECK (token_type IN ('verify', 'reset')),
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    used_at       TIMESTAMPTZ
);

CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens (user_id);
CREATE INDEX idx_email_verification_tokens_expires_at ON email_verification_tokens (expires_at);

-- OAuth accounts
CREATE TABLE IF NOT EXISTS oauth_accounts (
    id                BIGSERIAL PRIMARY KEY,
    user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider          VARCHAR(32) NOT NULL,
    provider_user_id  VARCHAR(255) NOT NULL,
    access_token_encrypted  BYTEA,
    refresh_token_encrypted BYTEA,
    expires_at        TIMESTAMPTZ,
    profile_data      JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(profile_data) = 'object'),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_user_id)
);

CREATE INDEX idx_oauth_accounts_user_id ON oauth_accounts (user_id);
CREATE INDEX idx_oauth_accounts_profile_data_gin ON oauth_accounts USING GIN (profile_data);

-- SSH keys
CREATE TABLE IF NOT EXISTS ssh_keys (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          VARCHAR(255) NOT NULL DEFAULT '',
    public_key    TEXT NOT NULL,
    fingerprint   VARCHAR(255) NOT NULL UNIQUE,
    key_type      VARCHAR(32) NOT NULL DEFAULT 'user',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ssh_keys_user_id ON ssh_keys (user_id);
CREATE INDEX idx_ssh_keys_fingerprint ON ssh_keys (fingerprint);

-- API access tokens
CREATE TABLE IF NOT EXISTS access_tokens (
    id                BIGSERIAL PRIMARY KEY,
    user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name              VARCHAR(255) NOT NULL DEFAULT '',
    token_hash        VARCHAR(255) NOT NULL UNIQUE,
    token_last_eight  VARCHAR(8) NOT NULL DEFAULT '',
    scopes            TEXT NOT NULL DEFAULT '',
    last_used_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_access_tokens_user_id ON access_tokens (user_id);
CREATE INDEX idx_access_tokens_token_hash ON access_tokens (token_hash);

-- Repositories
CREATE TABLE IF NOT EXISTS repositories (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT REFERENCES users(id) ON DELETE CASCADE,
    org_id              BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    lower_name          VARCHAR(255) NOT NULL,
    description         TEXT NOT NULL DEFAULT '',
    shard_id            VARCHAR(50) NOT NULL,
    is_public           BOOLEAN NOT NULL DEFAULT TRUE,
    default_bookmark    VARCHAR(255) NOT NULL DEFAULT 'main',
    topics              TEXT[] NOT NULL DEFAULT '{}'::text[],
    search_vector       TSVECTOR,
    next_issue_number   BIGINT NOT NULL DEFAULT 1,
    next_landing_number BIGINT NOT NULL DEFAULT 1,
    is_fork             BOOLEAN NOT NULL DEFAULT FALSE,
    fork_id             BIGINT REFERENCES repositories(id) ON DELETE SET NULL,
    is_template         BOOLEAN NOT NULL DEFAULT FALSE,
    template_id         BIGINT REFERENCES repositories(id) ON DELETE SET NULL,
    is_archived         BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at         TIMESTAMPTZ,
    is_mirror           BOOLEAN NOT NULL DEFAULT FALSE,
    mirror_destination  TEXT NOT NULL DEFAULT '',
    workspace_idle_timeout_secs INTEGER NOT NULL DEFAULT 1800 CHECK (workspace_idle_timeout_secs > 0),
    workspace_persistence VARCHAR(16) NOT NULL DEFAULT 'persistent'
                      CHECK (workspace_persistence IN ('persistent', 'ephemeral')),
    workspace_dependencies TEXT[] NOT NULL DEFAULT '{}'::text[],
    landing_queue_mode  VARCHAR(16) NOT NULL DEFAULT 'serialized'
                      CHECK (landing_queue_mode IN ('serialized', 'parallel')),
    landing_queue_required_checks TEXT[] NOT NULL DEFAULT '{}'::text[],
    num_stars           BIGINT NOT NULL DEFAULT 0,
    num_forks           BIGINT NOT NULL DEFAULT 0,
    num_watches         BIGINT NOT NULL DEFAULT 0,
    num_issues          BIGINT NOT NULL DEFAULT 0,
    num_closed_issues   BIGINT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (num_nonnulls(user_id, org_id) = 1)
);

CREATE INDEX idx_repositories_user_id ON repositories (user_id);
CREATE INDEX idx_repositories_org_id ON repositories (org_id);
CREATE INDEX idx_repositories_lower_name ON repositories (lower_name);
CREATE INDEX idx_repositories_topics_gin ON repositories USING GIN (topics);
CREATE INDEX idx_repositories_search_vector_gin ON repositories USING GIN (search_vector);
CREATE UNIQUE INDEX uq_repositories_user_lower_name
    ON repositories (user_id, lower_name)
    WHERE org_id IS NULL;
CREATE UNIQUE INDEX uq_repositories_org_lower_name
    ON repositories (org_id, lower_name)
    WHERE org_id IS NOT NULL;

-- Deploy keys (per-repository SSH keys)
CREATE TABLE IF NOT EXISTS deploy_keys (
    id               BIGSERIAL PRIMARY KEY,
    repository_id    BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    title            TEXT NOT NULL,
    key_fingerprint  TEXT NOT NULL,
    public_key       TEXT NOT NULL,
    read_only        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, key_fingerprint)
);

CREATE INDEX idx_deploy_keys_repo_id ON deploy_keys (repository_id);
CREATE INDEX idx_deploy_keys_fingerprint ON deploy_keys (key_fingerprint);


-- Git LFS objects
CREATE TABLE IF NOT EXISTS lfs_objects (
    id              BIGSERIAL PRIMARY KEY,
    repository_id   BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    oid             TEXT NOT NULL,
    size            BIGINT NOT NULL,
    gcs_path        TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, oid)
);

CREATE INDEX idx_lfs_objects_repo ON lfs_objects (repository_id);

-- Git LFS locks
CREATE TABLE IF NOT EXISTS lfs_locks (
    id              BIGSERIAL PRIMARY KEY,
    repository_id   BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    path            VARCHAR(2048) NOT NULL,
    owner_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, path)
);

CREATE INDEX idx_lfs_locks_repo ON lfs_locks (repository_id);
CREATE INDEX idx_lfs_locks_owner ON lfs_locks (owner_id);

-- Git LFS metadata
CREATE TABLE IF NOT EXISTS lfs_meta_objects (
    id             BIGSERIAL PRIMARY KEY,
    repository_id  BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    oid            VARCHAR(255) NOT NULL,
    size           BIGINT NOT NULL CHECK (size >= 0),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, oid)
);

CREATE INDEX idx_lfs_meta_objects_repository_id ON lfs_meta_objects (repository_id);
CREATE INDEX idx_lfs_meta_objects_oid ON lfs_meta_objects (oid);
CREATE TABLE IF NOT EXISTS code_search_documents (
    id             BIGSERIAL PRIMARY KEY,
    repository_id  BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    file_path      TEXT NOT NULL,
    content        TEXT NOT NULL DEFAULT '',
    search_vector  TSVECTOR,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, file_path)
);

CREATE INDEX idx_code_search_documents_repo_path
    ON code_search_documents (repository_id, file_path);
CREATE INDEX idx_code_search_documents_search_vector_gin
    ON code_search_documents USING GIN (search_vector);

CREATE TABLE IF NOT EXISTS search_rate_limits (
    scope           TEXT NOT NULL,
    principal_key   TEXT NOT NULL,
    tokens          DOUBLE PRECISION NOT NULL,
    last_refill_at  TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (scope, principal_key)
);

CREATE INDEX idx_search_rate_limits_updated_at ON search_rate_limits (updated_at);

-- Organization membership
CREATE TABLE IF NOT EXISTS org_members (
    id               BIGSERIAL PRIMARY KEY,
    organization_id  BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role             VARCHAR(16) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_members_user_id ON org_members (user_id);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
    id               BIGSERIAL PRIMARY KEY,
    organization_id  BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name             VARCHAR(255) NOT NULL,
    lower_name       VARCHAR(255) NOT NULL,
    description      TEXT NOT NULL DEFAULT '',
    permission       VARCHAR(16) NOT NULL DEFAULT 'read' CHECK (permission IN ('read', 'write', 'admin')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, lower_name)
);

CREATE INDEX idx_teams_org_id ON teams (organization_id);

CREATE TABLE IF NOT EXISTS team_members (
    id          BIGSERIAL PRIMARY KEY,
    team_id     BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (team_id, user_id)
);

CREATE INDEX idx_team_members_user_id ON team_members (user_id);

CREATE TABLE IF NOT EXISTS team_repos (
    id             BIGSERIAL PRIMARY KEY,
    team_id        BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    repository_id  BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (team_id, repository_id)
);

CREATE INDEX idx_team_repos_repository_id ON team_repos (repository_id);

CREATE TABLE IF NOT EXISTS collaborators (
    id             BIGSERIAL PRIMARY KEY,
    repository_id  BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission     VARCHAR(16) NOT NULL CHECK (permission IN ('read', 'write', 'admin')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, user_id)
);

CREATE INDEX idx_collaborators_user_id ON collaborators (user_id);

-- Milestones
CREATE TABLE IF NOT EXISTS milestones (
    id            BIGSERIAL PRIMARY KEY,
    repository_id BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    title         VARCHAR(255) NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    state         VARCHAR(16) NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'closed')),
    due_date      TIMESTAMPTZ,
    closed_at     TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, title)
);

CREATE INDEX idx_milestones_repo_state ON milestones (repository_id, state);

-- Issues
CREATE TABLE IF NOT EXISTS issues (
    id             BIGSERIAL PRIMARY KEY,
    repository_id  BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    number         BIGINT NOT NULL,
    title          VARCHAR(255) NOT NULL,
    body           TEXT NOT NULL DEFAULT '',
    search_vector  TSVECTOR,
    state          VARCHAR(16) NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'closed')),
    author_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    milestone_id   BIGINT REFERENCES milestones(id) ON DELETE SET NULL,
    comment_count  BIGINT NOT NULL DEFAULT 0,
    closed_at      TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, number)
);

CREATE INDEX idx_issues_repo_state ON issues (repository_id, state, number DESC);
CREATE INDEX idx_issues_open_partial ON issues (repository_id, number DESC) WHERE state = 'open';
CREATE INDEX idx_issues_search_vector_gin ON issues USING GIN (search_vector);

CREATE TABLE IF NOT EXISTS issue_comments (
    id            BIGSERIAL PRIMARY KEY,
    issue_id       BIGINT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    commenter      VARCHAR(255) NOT NULL DEFAULT '',
    body           TEXT NOT NULL,
    type           VARCHAR(32) NOT NULL DEFAULT 'comment',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_issue_comments_issue_id ON issue_comments (issue_id, created_at);

CREATE TABLE IF NOT EXISTS labels (
    id             BIGSERIAL PRIMARY KEY,
    repository_id  BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    name           VARCHAR(255) NOT NULL,
    color          VARCHAR(16) NOT NULL,
    description    TEXT NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, name)
);

CREATE INDEX idx_labels_repo_id ON labels (repository_id);

CREATE TABLE IF NOT EXISTS issue_labels (
    issue_id     BIGINT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    label_id     BIGINT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (issue_id, label_id)
);

CREATE TABLE IF NOT EXISTS issue_assignees (
    issue_id     BIGINT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (issue_id, user_id)
);

-- issue_event payload schema:
-- {"type": string, "before"?: any, "after"?: any, "meta"?: object}
CREATE TABLE IF NOT EXISTS issue_events (
    id          BIGSERIAL PRIMARY KEY,
    issue_id    BIGINT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    actor_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    event_type  VARCHAR(64) NOT NULL,
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_issue_events_issue_id ON issue_events (issue_id, created_at);
CREATE INDEX idx_issue_events_payload_gin ON issue_events USING GIN (payload);

CREATE TABLE IF NOT EXISTS issue_dependencies (
    issue_id             BIGINT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    depends_on_issue_id  BIGINT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (issue_id, depends_on_issue_id),
    CHECK (issue_id <> depends_on_issue_id)
);

CREATE TABLE IF NOT EXISTS pinned_issues (
    repository_id  BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    issue_id       BIGINT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    pinned_by_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
    position       SMALLINT NOT NULL DEFAULT 1,
    pinned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, issue_id),
    UNIQUE (repository_id, position),
    CHECK (position BETWEEN 1 AND 3)
);

-- Landing requests (jj-native)
CREATE TABLE IF NOT EXISTS landing_requests (
    id               BIGSERIAL PRIMARY KEY,
    repository_id    BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    number           BIGINT NOT NULL,
    title            VARCHAR(255) NOT NULL,
    body             TEXT NOT NULL DEFAULT '',
    state            VARCHAR(16) NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'closed', 'merged', 'draft', 'queued', 'landing')),
    author_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    target_bookmark  VARCHAR(255) NOT NULL,
    source_bookmark  VARCHAR(255) NOT NULL DEFAULT '',
    conflict_status  VARCHAR(16) NOT NULL DEFAULT 'unknown' CHECK (conflict_status IN ('clean', 'conflicted', 'unknown')),
    stack_size       BIGINT NOT NULL DEFAULT 0,
    queued_by        BIGINT REFERENCES users(id) ON DELETE SET NULL,
    queued_at        TIMESTAMPTZ,
    landing_started_at TIMESTAMPTZ,
    closed_at        TIMESTAMPTZ,
    merged_at        TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, number)
);

CREATE INDEX idx_landing_requests_repo_state ON landing_requests (repository_id, state, number DESC);
CREATE INDEX idx_landing_requests_open_partial ON landing_requests (repository_id, number DESC) WHERE state = 'open';

CREATE TABLE IF NOT EXISTS landing_tasks (
    id                 BIGSERIAL PRIMARY KEY,
    landing_request_id BIGINT NOT NULL REFERENCES landing_requests(id) ON DELETE CASCADE,
    repository_id      BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    status             VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed')),
    priority           SMALLINT NOT NULL DEFAULT 1 CHECK (priority BETWEEN 0 AND 3),
    attempt            INTEGER NOT NULL DEFAULT 0,
    last_error         TEXT,
    available_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at         TIMESTAMPTZ,
    finished_at        TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (landing_request_id)
);

CREATE INDEX idx_landing_tasks_status_priority ON landing_tasks (status, priority DESC, created_at ASC) WHERE status = 'pending';
CREATE INDEX idx_landing_tasks_repo_running ON landing_tasks (repository_id) WHERE status = 'running';

CREATE TABLE IF NOT EXISTS landing_request_changes (
    id                BIGSERIAL PRIMARY KEY,
    landing_request_id BIGINT NOT NULL REFERENCES landing_requests(id) ON DELETE CASCADE,
    change_id         VARCHAR(255) NOT NULL,
    position_in_stack BIGINT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (landing_request_id, change_id),
    UNIQUE (landing_request_id, position_in_stack)
);

CREATE INDEX idx_landing_request_changes_lr_id ON landing_request_changes (landing_request_id, position_in_stack);

CREATE TABLE IF NOT EXISTS landing_request_reviews (
    id                BIGSERIAL PRIMARY KEY,
    landing_request_id BIGINT NOT NULL REFERENCES landing_requests(id) ON DELETE CASCADE,
    reviewer_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type              VARCHAR(32) NOT NULL CHECK (type IN ('pending', 'approve', 'comment', 'request_changes')),
    body              TEXT NOT NULL DEFAULT '',
    state             VARCHAR(32) NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted', 'dismissed')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_landing_request_reviews_lr_id ON landing_request_reviews (landing_request_id, created_at);

CREATE TABLE IF NOT EXISTS landing_request_comments (
    id                BIGSERIAL PRIMARY KEY,
    landing_request_id BIGINT NOT NULL REFERENCES landing_requests(id) ON DELETE CASCADE,
    user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    path              TEXT NOT NULL DEFAULT '',
    line              BIGINT NOT NULL DEFAULT 0,
    side              VARCHAR(8) NOT NULL DEFAULT 'right' CHECK (side IN ('left', 'right', 'both')),
    body              TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_landing_request_comments_lr_id ON landing_request_comments (landing_request_id, created_at);

-- jj-native VCS cache tables
CREATE TABLE IF NOT EXISTS bookmarks (
    id                BIGSERIAL PRIMARY KEY,
    repository_id     BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    name              VARCHAR(255) NOT NULL,
    target_change_id  VARCHAR(255) NOT NULL DEFAULT '',
    is_default        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, name)
);

CREATE UNIQUE INDEX uq_bookmarks_single_default_per_repo
    ON bookmarks (repository_id)
    WHERE is_default = TRUE;
CREATE INDEX idx_bookmarks_repo_name ON bookmarks (repository_id, name);

CREATE TABLE IF NOT EXISTS changes (
    id                 BIGSERIAL PRIMARY KEY,
    repository_id      BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    change_id          VARCHAR(255) NOT NULL,
    commit_id          VARCHAR(255) NOT NULL DEFAULT '',
    description        TEXT NOT NULL DEFAULT '',
    author_name        VARCHAR(255) NOT NULL DEFAULT '',
    author_email       VARCHAR(255) NOT NULL DEFAULT '',
    has_conflict       BOOLEAN NOT NULL DEFAULT FALSE,
    is_empty           BOOLEAN NOT NULL DEFAULT FALSE,
    parent_change_ids  JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(parent_change_ids) = 'array'),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, change_id)
);

CREATE INDEX idx_changes_repo_id_desc ON changes (repository_id, id DESC);
CREATE INDEX idx_changes_parent_change_ids_gin ON changes USING GIN (parent_change_ids);

CREATE TABLE IF NOT EXISTS conflicts (
    id                 BIGSERIAL PRIMARY KEY,
    repository_id      BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    change_id          VARCHAR(255) NOT NULL,
    file_path          TEXT NOT NULL,
    conflict_type      VARCHAR(32) NOT NULL CHECK (conflict_type IN ('content', 'rename', 'delete')),
    resolved           BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by        BIGINT REFERENCES users(id) ON DELETE SET NULL,
    resolution_method  VARCHAR(32) NOT NULL DEFAULT '' CHECK (resolution_method IN ('', 'manual', 'theirs', 'ours', 'base')),
    resolved_at        TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, change_id, file_path)
);

CREATE INDEX idx_conflicts_repo_change ON conflicts (repository_id, change_id, file_path);
CREATE INDEX idx_conflicts_repo_change_resolved ON conflicts (repository_id, change_id, resolved);

CREATE TABLE IF NOT EXISTS protected_bookmarks (
    id                  BIGSERIAL PRIMARY KEY,
    repository_id       BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    pattern             VARCHAR(255) NOT NULL,
    require_review      BOOLEAN NOT NULL DEFAULT TRUE,
    required_approvals  BIGINT NOT NULL DEFAULT 1 CHECK (required_approvals >= 0),
    required_checks     TEXT[] NOT NULL DEFAULT '{}'::text[],
    require_status_checks     BOOLEAN NOT NULL DEFAULT FALSE,
    required_status_contexts  TEXT[] NOT NULL DEFAULT '{}',
    dismiss_stale_reviews BOOLEAN NOT NULL DEFAULT FALSE,
    restrict_push_teams TEXT[] NOT NULL DEFAULT '{}'::text[],
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, pattern)
);

CREATE INDEX idx_protected_bookmarks_repo_pattern ON protected_bookmarks (repository_id, pattern);

CREATE TABLE IF NOT EXISTS jj_operations (
    id                   BIGSERIAL PRIMARY KEY,
    repository_id        BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    operation_id         VARCHAR(255) NOT NULL,
    operation_type       VARCHAR(64) NOT NULL,
    description          TEXT NOT NULL DEFAULT '',
    user_id              BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    parent_operation_id  VARCHAR(255) NOT NULL DEFAULT '',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, operation_id)
);

CREATE INDEX idx_jj_operations_repo_created_at ON jj_operations (repository_id, created_at DESC, id DESC);

-- Reactions (issue/landing/comment targets)
CREATE TABLE IF NOT EXISTS reactions (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type  VARCHAR(32) NOT NULL CHECK (target_type IN ('issue', 'issue_comment', 'landing_request', 'landing_comment')),
    target_id    BIGINT NOT NULL,
    emoji        VARCHAR(64) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, target_type, target_id, emoji)
);

CREATE INDEX idx_reactions_target ON reactions (target_type, target_id);

-- Mentions
CREATE TABLE IF NOT EXISTS mentions (
    id                 BIGSERIAL PRIMARY KEY,
    repository_id      BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    issue_id           BIGINT REFERENCES issues(id) ON DELETE CASCADE,
    landing_request_id BIGINT REFERENCES landing_requests(id) ON DELETE CASCADE,
    comment_type       VARCHAR(32) NOT NULL CHECK (comment_type IN ('issue_comment', 'landing_comment', 'issue_body', 'landing_body')),
    comment_id         BIGINT,
    user_id            BIGINT REFERENCES users(id) ON DELETE SET NULL,
    mentioned_user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (comment_type, comment_id, mentioned_user_id)
);

CREATE INDEX idx_mentions_mentioned_user ON mentions (mentioned_user_id, created_at DESC);

-- workflow config JSON schema (object root):
-- {
--   "triggers": [{"type": "push"|"landing_request"|"schedule"|"manual", ...}],
--   "steps": [{"name": string, "run"?: string, "agent"?: object}],
--   "env"?: object
-- }
CREATE TABLE IF NOT EXISTS workflow_definitions (
    id             BIGSERIAL PRIMARY KEY,
    repository_id  BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    name           VARCHAR(255) NOT NULL,
    path           TEXT NOT NULL,
    config         JSONB NOT NULL CHECK (jsonb_typeof(config) = 'object'),
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, path)
);

CREATE INDEX idx_workflow_definitions_repo_id ON workflow_definitions (repository_id);
CREATE INDEX idx_workflow_definitions_config_gin ON workflow_definitions USING GIN (config);

CREATE TABLE IF NOT EXISTS workflow_schedule_specs (
    id                     BIGSERIAL PRIMARY KEY,
    workflow_definition_id BIGINT NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    repository_id          BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    cron_expression        TEXT NOT NULL,
    next_fire_at           TIMESTAMPTZ NOT NULL,
    prev_fire_at           TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workflow_definition_id, cron_expression)
);

CREATE INDEX idx_workflow_schedule_specs_next_fire
    ON workflow_schedule_specs (next_fire_at ASC);

CREATE TABLE IF NOT EXISTS workflow_runs (
    id                     BIGSERIAL PRIMARY KEY,
    repository_id          BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    workflow_definition_id BIGINT NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    status                 VARCHAR(16) NOT NULL CHECK (status IN ('queued', 'running', 'success', 'failure', 'cancelled')),
    trigger_event          VARCHAR(64) NOT NULL,
    trigger_ref            VARCHAR(255) NOT NULL DEFAULT '',
    trigger_commit_sha     VARCHAR(255) NOT NULL DEFAULT '',
    dispatch_inputs        JSONB,
    agent_token_hash       VARCHAR(64) UNIQUE,
    agent_token_expires_at TIMESTAMPTZ,
    started_at             TIMESTAMPTZ,
    completed_at           TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_runs_repo_id ON workflow_runs (repository_id, created_at DESC);
CREATE INDEX idx_workflow_runs_status_partial ON workflow_runs (repository_id, created_at DESC) WHERE status IN ('queued', 'running');
CREATE INDEX idx_workflow_runs_agent_token ON workflow_runs (agent_token_hash) WHERE agent_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS workflow_steps (
    id               BIGSERIAL PRIMARY KEY,
    workflow_run_id  BIGINT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    name             VARCHAR(255) NOT NULL,
    position         BIGINT NOT NULL,
    status           VARCHAR(16) NOT NULL CHECK (status IN ('queued', 'running', 'success', 'failure', 'skipped', 'cancelled')),
    started_at       TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workflow_run_id, position)
);

CREATE INDEX idx_workflow_steps_run_id ON workflow_steps (workflow_run_id, position);

-- workflow task payload schema (object root):
-- {
--   "kind": string,
--   "inputs"?: object,
--   "runner"?: object
-- }
CREATE TABLE IF NOT EXISTS workflow_tasks (
    id                BIGSERIAL PRIMARY KEY,
    workflow_run_id   BIGINT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    workflow_step_id  BIGINT NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
    repository_id     BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    status            VARCHAR(16) NOT NULL CHECK (status IN ('pending', 'assigned', 'running', 'done', 'failed', 'cancelled', 'blocked', 'skipped')),
    priority          SMALLINT NOT NULL DEFAULT 1 CHECK (priority BETWEEN 0 AND 3),
    payload           JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
    available_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attempt           INTEGER NOT NULL DEFAULT 0,
    runner_id         BIGINT,
    freestyle_vm_id   TEXT,
    assigned_at       TIMESTAMPTZ,
    started_at        TIMESTAMPTZ,
    finished_at       TIMESTAMPTZ,
    last_error        TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_tasks_pending_dequeue
    ON workflow_tasks (priority DESC, created_at ASC, id ASC, available_at ASC)
    WHERE status = 'pending';
CREATE INDEX idx_workflow_tasks_runner_id
    ON workflow_tasks (runner_id)
    WHERE runner_id IS NOT NULL;
CREATE INDEX idx_workflow_tasks_freestyle_vm_id
    ON workflow_tasks (freestyle_vm_id)
    WHERE freestyle_vm_id IS NOT NULL;
CREATE INDEX idx_workflow_tasks_payload_gin ON workflow_tasks USING GIN (payload);

CREATE TABLE IF NOT EXISTS workflow_logs (
    id               BIGSERIAL PRIMARY KEY,
    workflow_run_id  BIGINT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    workflow_step_id BIGINT NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
    sequence         BIGINT NOT NULL,
    stream           VARCHAR(16) NOT NULL CHECK (stream IN ('stdout', 'stderr', 'system')),
    entry            TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workflow_step_id, sequence)
);

CREATE INDEX idx_workflow_logs_run_id ON workflow_logs (workflow_run_id, id);

CREATE TABLE IF NOT EXISTS commit_statuses (
    id               BIGSERIAL PRIMARY KEY,
    repository_id    BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    change_id        VARCHAR(255),
    commit_sha       VARCHAR(255),
    context          VARCHAR(255) NOT NULL,
    status           VARCHAR(16) NOT NULL CHECK (status IN ('pending', 'success', 'failure', 'error', 'cancelled')),
    description      TEXT NOT NULL DEFAULT '',
    target_url       TEXT NOT NULL DEFAULT '',
    workflow_run_id  BIGINT REFERENCES workflow_runs(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_commit_statuses_repo_change ON commit_statuses (repository_id, change_id, created_at DESC);
CREATE INDEX idx_commit_statuses_repo_sha ON commit_statuses (repository_id, commit_sha, created_at DESC);

-- runner metadata schema (object root)
CREATE TABLE IF NOT EXISTS runner_pool (
    id                 BIGSERIAL PRIMARY KEY,
    name               VARCHAR(255) NOT NULL UNIQUE,
    status             VARCHAR(16) NOT NULL CHECK (status IN ('idle', 'busy', 'offline', 'draining')),
    last_heartbeat_at  TIMESTAMPTZ,
    metadata           JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_runner_pool_status ON runner_pool (status);
CREATE INDEX idx_runner_pool_metadata_gin ON runner_pool USING GIN (metadata);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'workflow_tasks_runner_id_fkey'
    ) THEN
        ALTER TABLE workflow_tasks
            ADD CONSTRAINT workflow_tasks_runner_id_fkey
            FOREIGN KEY (runner_id) REFERENCES runner_pool(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Agent sessions/messages/parts
CREATE TABLE IF NOT EXISTS agent_sessions (
    id               UUID PRIMARY KEY,
    repository_id    BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workflow_run_id  BIGINT REFERENCES workflow_runs(id) ON DELETE SET NULL,
    title            VARCHAR(255) NOT NULL DEFAULT '',
    status           VARCHAR(16) NOT NULL CHECK (status IN ('active', 'completed', 'failed', 'cancelled', 'timed_out')),
    started_at       TIMESTAMPTZ,
    finished_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_sessions_repo_id ON agent_sessions (repository_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_messages (
    id          BIGSERIAL PRIMARY KEY,
    session_id  UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
    role        VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    sequence    BIGINT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, sequence)
);

CREATE INDEX idx_agent_messages_session_id ON agent_messages (session_id, sequence);

-- part content schema (object root)
CREATE TABLE IF NOT EXISTS agent_parts (
    id          BIGSERIAL PRIMARY KEY,
    message_id  BIGINT NOT NULL REFERENCES agent_messages(id) ON DELETE CASCADE,
    part_index  BIGINT NOT NULL,
    part_type   VARCHAR(32) NOT NULL,
    content     JSONB NOT NULL CHECK (jsonb_typeof(content) = 'object'),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (message_id, part_index)
);

CREATE INDEX idx_agent_parts_message_id ON agent_parts (message_id, part_index);
CREATE INDEX idx_agent_parts_content_gin ON agent_parts USING GIN (content);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_type   VARCHAR(64) NOT NULL,
    source_id     BIGINT,
    subject       VARCHAR(255) NOT NULL DEFAULT '',
    body          TEXT NOT NULL DEFAULT '',
    status        VARCHAR(16) NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'pinned')),
    read_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_created ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_unread_partial ON notifications (user_id, created_at DESC) WHERE status = 'unread';

-- Social tables
CREATE TABLE IF NOT EXISTS stars (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    repository_id  BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, repository_id)
);

CREATE INDEX idx_stars_repository_id ON stars (repository_id);

CREATE TABLE IF NOT EXISTS watches (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    repository_id  BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    mode           VARCHAR(16) NOT NULL DEFAULT 'watching' CHECK (mode IN ('watching', 'ignored', 'participating')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, repository_id)
);

CREATE INDEX idx_watches_repository_id ON watches (repository_id);

-- Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
    id                BIGSERIAL PRIMARY KEY,
    repository_id     BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    url               TEXT NOT NULL,
    -- Encrypted ciphertext for the webhook HMAC signing secret.
    secret            TEXT NOT NULL DEFAULT '',
    events            TEXT[] NOT NULL DEFAULT '{}'::text[],
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    last_delivery_at  TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhooks_repository_id ON webhooks (repository_id);
CREATE INDEX idx_webhooks_events_gin ON webhooks USING GIN (events);

-- webhook payload schema (object root)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id               BIGSERIAL PRIMARY KEY,
    webhook_id       BIGINT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type       VARCHAR(64) NOT NULL,
    payload          JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
    status           VARCHAR(16) NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
    response_status  INTEGER,
    response_body    TEXT NOT NULL DEFAULT '',
    attempts         INTEGER NOT NULL DEFAULT 0,
    delivered_at     TIMESTAMPTZ,
    next_retry_at    TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries (webhook_id, created_at DESC);
CREATE INDEX idx_webhook_deliveries_pending_partial
    ON webhook_deliveries (next_retry_at, id)
    WHERE status = 'pending';
CREATE INDEX idx_webhook_deliveries_payload_gin ON webhook_deliveries USING GIN (payload);

-- Search vectors and trigger maintenance
CREATE OR REPLACE FUNCTION set_repository_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(array_to_string(NEW.topics, ' '), '')), 'C');
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION set_issue_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.body, '')), 'B');
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION set_user_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('simple', COALESCE(NEW.username, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.display_name, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(NEW.bio, '')), 'C');
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION set_code_search_document_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('simple', COALESCE(NEW.file_path, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.content, '')), 'B');
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION can_view_repository(p_repository_id BIGINT, p_viewer_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM repositories r
        WHERE r.id = p_repository_id
          AND (
            r.is_public = TRUE
            OR (
              p_viewer_id > 0
              AND (
                r.user_id = p_viewer_id
                OR EXISTS (
                  SELECT 1
                  FROM org_members om
                  WHERE om.organization_id = r.org_id
                    AND om.user_id = p_viewer_id
                    AND om.role = 'owner'
                )
                OR EXISTS (
                  SELECT 1
                  FROM team_repos tr
                  JOIN team_members tm ON tm.team_id = tr.team_id
                  WHERE tr.repository_id = r.id
                    AND tm.user_id = p_viewer_id
                )
                OR EXISTS (
                  SELECT 1
                  FROM collaborators c
                  WHERE c.repository_id = r.id
                    AND c.user_id = p_viewer_id
                )
              )
            )
          )
    );
$$;

CREATE TRIGGER trg_repositories_search_vector
BEFORE INSERT OR UPDATE OF name, description, topics
ON repositories
FOR EACH ROW
EXECUTE FUNCTION set_repository_search_vector();

CREATE TRIGGER trg_issues_search_vector
BEFORE INSERT OR UPDATE OF title, body
ON issues
FOR EACH ROW
EXECUTE FUNCTION set_issue_search_vector();

CREATE TRIGGER trg_users_search_vector
BEFORE INSERT OR UPDATE OF username, display_name, bio
ON users
FOR EACH ROW
EXECUTE FUNCTION set_user_search_vector();

CREATE TRIGGER trg_code_search_documents_search_vector
BEFORE INSERT OR UPDATE OF file_path, content
ON code_search_documents
FOR EACH ROW
EXECUTE FUNCTION set_code_search_document_vector();

UPDATE repositories
SET search_vector =
    setweight(to_tsvector('simple', COALESCE(name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(description, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(array_to_string(topics, ' '), '')), 'C');

UPDATE issues
SET search_vector =
    setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(body, '')), 'B');

UPDATE users
SET search_vector =
    setweight(to_tsvector('simple', COALESCE(username, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(display_name, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(bio, '')), 'C');

UPDATE code_search_documents
SET search_vector =
    setweight(to_tsvector('simple', COALESCE(file_path, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(content, '')), 'B');

-- Atomic per-repository issue number allocation
CREATE OR REPLACE FUNCTION get_next_issue_number(repo_id BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    next_num BIGINT;
BEGIN
    UPDATE repositories
    SET next_issue_number = next_issue_number + 1,
        updated_at = NOW()
    WHERE id = repo_id
    RETURNING next_issue_number - 1 INTO next_num;

    IF next_num IS NULL THEN
        RAISE EXCEPTION 'repository % not found', repo_id;
    END IF;

    RETURN next_num;
END;
$$;

-- Atomic per-repository landing request number allocation
CREATE OR REPLACE FUNCTION get_next_landing_number(repo_id BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    next_num BIGINT;
BEGIN
    UPDATE repositories
    SET next_landing_number = next_landing_number + 1,
        updated_at = NOW()
    WHERE id = repo_id
    RETURNING next_landing_number - 1 INTO next_num;

    IF next_num IS NULL THEN
        RAISE EXCEPTION 'repository % not found', repo_id;
    END IF;

    RETURN next_num;
END;
$$;

-- Set exactly one default bookmark per repository.
CREATE OR REPLACE FUNCTION set_default_bookmark(p_repo_id BIGINT, p_bookmark_name VARCHAR)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    target_bookmark_id BIGINT;
    cleared_rows BIGINT;
    set_rows BIGINT;
    updated_rows BIGINT;
BEGIN
    SELECT id
    INTO target_bookmark_id
    FROM bookmarks
    WHERE repository_id = p_repo_id
      AND name = p_bookmark_name
    FOR UPDATE;

    IF target_bookmark_id IS NULL THEN
        RAISE EXCEPTION 'bookmark % not found in repository %', p_bookmark_name, p_repo_id;
    END IF;

    UPDATE bookmarks
    SET is_default = FALSE,
        updated_at = NOW()
    WHERE repository_id = p_repo_id
      AND is_default = TRUE
      AND id <> target_bookmark_id;

    GET DIAGNOSTICS cleared_rows = ROW_COUNT;

    UPDATE bookmarks
    SET is_default = TRUE,
        updated_at = NOW()
    WHERE id = target_bookmark_id
      AND is_default = FALSE;

    GET DIAGNOSTICS set_rows = ROW_COUNT;
    updated_rows = cleared_rows + set_rows;

    RETURN updated_rows;
END;
$$;

-- Wiki pages
CREATE TABLE IF NOT EXISTS wiki_pages (
    id              BIGSERIAL PRIMARY KEY,
    repository_id   BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    slug            TEXT NOT NULL,
    title           TEXT NOT NULL,
    body            TEXT NOT NULL DEFAULT '',
    author_id       BIGINT NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, slug)
);

CREATE INDEX idx_wiki_pages_repo ON wiki_pages(repository_id);

-- Workspaces: one pod per user+repo (multi-PTY container)
CREATE TABLE IF NOT EXISTS workspaces (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id     BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name              TEXT NOT NULL DEFAULT '',
    is_fork           BOOLEAN NOT NULL DEFAULT FALSE,
    parent_workspace_id TEXT NOT NULL DEFAULT '',
    source_snapshot_id TEXT NOT NULL DEFAULT '',
    freestyle_vm_id   TEXT NOT NULL DEFAULT '',
    status            VARCHAR(16) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'starting', 'running', 'suspended', 'stopped', 'failed')),
    last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    idle_timeout_secs INTEGER NOT NULL DEFAULT 1800,
    suspended_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active primary workspace per user+repo. Forks and snapshot-derived
-- workspaces are tracked as separate derived workspaces.
CREATE UNIQUE INDEX uq_workspaces_active ON workspaces (repository_id, user_id)
    WHERE is_fork = FALSE
      AND (
          status IN ('running', 'suspended')
          OR (status = 'starting' AND freestyle_vm_id <> '')
      );
CREATE INDEX idx_workspaces_status ON workspaces (status) WHERE status IN ('pending', 'starting', 'running', 'suspended');

CREATE TABLE IF NOT EXISTS workspace_snapshots (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id         BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    user_id               BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id          TEXT NOT NULL DEFAULT '',
    name                  TEXT NOT NULL,
    freestyle_snapshot_id TEXT NOT NULL DEFAULT '',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workspace_snapshots_repo_id ON workspace_snapshots (repository_id, created_at DESC);
CREATE INDEX idx_workspace_snapshots_workspace_id ON workspace_snapshots (workspace_id);

-- Workspace terminal sessions: lightweight PTY processes within a workspace
CREATE TABLE IF NOT EXISTS workspace_sessions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    repository_id     BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ssh_connection_info JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(ssh_connection_info) = 'object'),
    status            VARCHAR(16) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'starting', 'running', 'stopped', 'failed')),
    cols              INTEGER NOT NULL DEFAULT 80,
    rows              INTEGER NOT NULL DEFAULT 24,
    last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    idle_timeout_secs INTEGER NOT NULL DEFAULT 1800,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workspace_sessions_repo_id ON workspace_sessions (repository_id, created_at DESC);
CREATE INDEX idx_workspace_sessions_user_id ON workspace_sessions (user_id);
CREATE INDEX idx_workspace_sessions_workspace_id ON workspace_sessions (workspace_id);
CREATE INDEX idx_workspace_sessions_status ON workspace_sessions (status) WHERE status IN ('pending', 'starting', 'running');

-- Repository secrets (encrypted at rest)
CREATE TABLE IF NOT EXISTS repository_secrets (
    id              BIGSERIAL PRIMARY KEY,
    repository_id   BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    value_encrypted BYTEA NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, name)
);
CREATE INDEX idx_repository_secrets_repo_id ON repository_secrets (repository_id);

-- Repository variables (plaintext)
CREATE TABLE IF NOT EXISTS repository_variables (
    id              BIGSERIAL PRIMARY KEY,
    repository_id   BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    value           TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, name)
);
CREATE INDEX idx_repository_variables_repo_id ON repository_variables (repository_id);

-- Audit log (observability Phase 3: "who pushed?")
CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL PRIMARY KEY,
    event_type  VARCHAR(64) NOT NULL,
    actor_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    actor_name  VARCHAR(255) NOT NULL DEFAULT '',
    target_type VARCHAR(64) NOT NULL DEFAULT '',
    target_id   BIGINT,
    target_name VARCHAR(255) NOT NULL DEFAULT '',
    action      VARCHAR(32) NOT NULL,
    metadata    JSONB NOT NULL DEFAULT '{}',
    ip_address  VARCHAR(45) NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_event_type ON audit_log (event_type);
CREATE INDEX idx_audit_log_actor_id ON audit_log (actor_id);
CREATE INDEX idx_audit_log_created_at ON audit_log (created_at);
CREATE INDEX idx_audit_log_target ON audit_log (target_type, target_id);

-- OAuth2 applications (third-party app authorization)
CREATE TABLE IF NOT EXISTS oauth2_applications (
    id                BIGSERIAL PRIMARY KEY,
    client_id         VARCHAR(64) NOT NULL UNIQUE,
    client_secret_hash VARCHAR(64) NOT NULL,
    name              VARCHAR(255) NOT NULL,
    redirect_uris     TEXT[] NOT NULL DEFAULT '{}'::text[],
    scopes            TEXT[] NOT NULL DEFAULT '{}'::text[],
    owner_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    confidential      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth2_applications_client_id ON oauth2_applications (client_id);
CREATE INDEX idx_oauth2_applications_owner_id ON oauth2_applications (owner_id);

-- OAuth2 authorization codes (short-lived, single-use)
CREATE TABLE IF NOT EXISTS oauth2_authorization_codes (
    code_hash     VARCHAR(64) NOT NULL UNIQUE,
    app_id        BIGINT NOT NULL REFERENCES oauth2_applications(id) ON DELETE CASCADE,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scopes        TEXT[] NOT NULL DEFAULT '{}'::text[],
    redirect_uri  TEXT NOT NULL,
    code_challenge TEXT NOT NULL DEFAULT '',
    code_challenge_method VARCHAR(16) NOT NULL DEFAULT '',
    expires_at    TIMESTAMPTZ NOT NULL,
    used_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth2_authorization_codes_app_id ON oauth2_authorization_codes (app_id);
CREATE INDEX idx_oauth2_authorization_codes_expires_at ON oauth2_authorization_codes (expires_at);

-- OAuth2 access tokens (issued to third-party apps)
CREATE TABLE IF NOT EXISTS oauth2_access_tokens (
    id            BIGSERIAL PRIMARY KEY,
    token_hash    VARCHAR(64) NOT NULL UNIQUE,
    app_id        BIGINT NOT NULL REFERENCES oauth2_applications(id) ON DELETE CASCADE,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scopes        TEXT[] NOT NULL DEFAULT '{}'::text[],
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth2_access_tokens_token_hash ON oauth2_access_tokens (token_hash);
CREATE INDEX idx_oauth2_access_tokens_app_id ON oauth2_access_tokens (app_id);
CREATE INDEX idx_oauth2_access_tokens_user_id ON oauth2_access_tokens (user_id);
CREATE INDEX idx_oauth2_access_tokens_expires_at ON oauth2_access_tokens (expires_at);

-- OAuth2 refresh tokens (long-lived, rotatable)
CREATE TABLE IF NOT EXISTS oauth2_refresh_tokens (
    id            BIGSERIAL PRIMARY KEY,
    token_hash    VARCHAR(64) NOT NULL UNIQUE,
    app_id        BIGINT NOT NULL REFERENCES oauth2_applications(id) ON DELETE CASCADE,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scopes        TEXT[],
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth2_refresh_tokens_token_hash ON oauth2_refresh_tokens (token_hash);
CREATE INDEX idx_oauth2_refresh_tokens_app_id ON oauth2_refresh_tokens (app_id);
CREATE INDEX idx_oauth2_refresh_tokens_user_id ON oauth2_refresh_tokens (user_id);
CREATE INDEX idx_oauth2_refresh_tokens_expires_at ON oauth2_refresh_tokens (expires_at);

-- Workflow caches (dependency caching between workflow runs)
CREATE TABLE IF NOT EXISTS workflow_caches (
    id                BIGSERIAL PRIMARY KEY,
    repository_id     BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    workflow_run_id   BIGINT REFERENCES workflow_runs(id) ON DELETE SET NULL,
    bookmark_name     VARCHAR(255) NOT NULL,
    cache_key         VARCHAR(512) NOT NULL,
    cache_version     VARCHAR(64) NOT NULL DEFAULT 'static',
    object_key        TEXT NOT NULL,
    object_size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (object_size_bytes >= 0),
    compression       VARCHAR(32) NOT NULL DEFAULT 'tar+gzip',
    status            VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'finalized')),
    hit_count         BIGINT NOT NULL DEFAULT 0,
    last_hit_at       TIMESTAMPTZ,
    finalized_at      TIMESTAMPTZ,
    expires_at        TIMESTAMPTZ NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, bookmark_name, cache_key, cache_version)
);

CREATE INDEX idx_workflow_caches_repo_id ON workflow_caches (repository_id);
CREATE INDEX idx_workflow_caches_restore_lookup ON workflow_caches (
    repository_id,
    bookmark_name,
    cache_key,
    cache_version,
    status,
    expires_at DESC
);
CREATE INDEX idx_workflow_caches_eviction ON workflow_caches (
    repository_id,
    status,
    expires_at,
    last_hit_at,
    finalized_at,
    updated_at,
    created_at
);

-- Workflow artifacts (build outputs shared between steps and runs)
CREATE TABLE IF NOT EXISTS workflow_artifacts (
    id                  BIGSERIAL PRIMARY KEY,
    repository_id       BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    workflow_run_id     BIGINT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    size                BIGINT NOT NULL DEFAULT 0 CHECK (size >= 0),
    content_type        VARCHAR(255) NOT NULL DEFAULT 'application/octet-stream',
    status              VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready')),
    gcs_key             TEXT NOT NULL,
    confirmed_at        TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ NOT NULL,
    release_tag         TEXT,
    release_asset_name  TEXT,
    release_attached_at TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workflow_run_id, name)
);

CREATE INDEX idx_workflow_artifacts_repo_id ON workflow_artifacts (repository_id, created_at DESC);
CREATE INDEX idx_workflow_artifacts_run_id ON workflow_artifacts (workflow_run_id, created_at DESC);
CREATE INDEX idx_workflow_artifacts_expires_at ON workflow_artifacts (expires_at);

-- Releases (tags with metadata and uploaded assets)
CREATE TABLE IF NOT EXISTS releases (
    id            BIGSERIAL PRIMARY KEY,
    repository_id BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    publisher_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tag_name      VARCHAR(255) NOT NULL,
    target        VARCHAR(255) NOT NULL DEFAULT '',
    title         VARCHAR(255) NOT NULL DEFAULT '',
    body          TEXT NOT NULL DEFAULT '',
    sha           VARCHAR(255) NOT NULL DEFAULT '',
    is_draft      BOOLEAN NOT NULL DEFAULT FALSE,
    is_prerelease BOOLEAN NOT NULL DEFAULT FALSE,
    is_tag        BOOLEAN NOT NULL DEFAULT FALSE,
    published_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, tag_name)
);

CREATE INDEX idx_releases_repo_id ON releases (repository_id, (COALESCE(published_at, created_at)) DESC, id DESC);
CREATE INDEX idx_releases_tag_name ON releases (repository_id, tag_name);

CREATE TABLE IF NOT EXISTS release_assets (
    id             BIGSERIAL PRIMARY KEY,
    release_id     BIGINT NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
    uploader_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name           VARCHAR(255) NOT NULL,
    size           BIGINT NOT NULL DEFAULT 0 CHECK (size >= 0),
    download_count BIGINT NOT NULL DEFAULT 0 CHECK (download_count >= 0),
    status         VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready')),
    gcs_key        TEXT NOT NULL,
    content_type   VARCHAR(255) NOT NULL DEFAULT 'application/octet-stream',
    confirmed_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (release_id, name)
);

CREATE INDEX idx_release_assets_release_id ON release_assets (release_id, created_at DESC);

-- Stripe-backed billing projection
CREATE TABLE IF NOT EXISTS billing_accounts (
    id                    BIGSERIAL PRIMARY KEY,
    owner_type            VARCHAR(16) NOT NULL CHECK (owner_type IN ('user', 'org')),
    owner_id              BIGINT NOT NULL,
    stripe_customer_id    VARCHAR(255) NOT NULL UNIQUE,
    stripe_customer_email VARCHAR(255) NOT NULL DEFAULT '',
    stripe_customer_name  VARCHAR(255) NOT NULL DEFAULT '',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (owner_type, owner_id)
);

CREATE INDEX idx_billing_accounts_owner
    ON billing_accounts (owner_type, owner_id);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
    id                     BIGSERIAL PRIMARY KEY,
    billing_account_id     BIGINT NOT NULL REFERENCES billing_accounts(id) ON DELETE CASCADE,
    stripe_subscription_id VARCHAR(255) NOT NULL UNIQUE,
    stripe_price_id        VARCHAR(255) NOT NULL DEFAULT '',
    plan_key               VARCHAR(64) NOT NULL DEFAULT '',
    billing_interval       VARCHAR(16) NOT NULL DEFAULT '' CHECK (billing_interval IN ('', 'monthly', 'annual')),
    status                 VARCHAR(32) NOT NULL,
    quantity               BIGINT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    trial_end              TIMESTAMPTZ,
    current_period_start   TIMESTAMPTZ,
    current_period_end     TIMESTAMPTZ,
    cancel_at_period_end   BOOLEAN NOT NULL DEFAULT FALSE,
    canceled_at            TIMESTAMPTZ,
    raw_payload            JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(raw_payload) = 'object'),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_subscriptions_account_updated
    ON billing_subscriptions (billing_account_id, updated_at DESC);

CREATE INDEX idx_billing_subscriptions_account_status
    ON billing_subscriptions (billing_account_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS billing_entitlements (
    id                 BIGSERIAL PRIMARY KEY,
    billing_account_id BIGINT NOT NULL REFERENCES billing_accounts(id) ON DELETE CASCADE,
    feature_key        VARCHAR(255) NOT NULL,
    active             BOOLEAN NOT NULL DEFAULT TRUE,
    last_synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (billing_account_id, feature_key)
);

CREATE INDEX idx_billing_entitlements_account_active
    ON billing_entitlements (billing_account_id, active);

CREATE TABLE IF NOT EXISTS billing_usage_counters (
    id                           BIGSERIAL PRIMARY KEY,
    owner_type                   VARCHAR(16) NOT NULL CHECK (owner_type IN ('user', 'org')),
    owner_id                     BIGINT NOT NULL,
    metric_key                   VARCHAR(64) NOT NULL,
    period_start                 TIMESTAMPTZ NOT NULL,
    period_end                   TIMESTAMPTZ NOT NULL,
    included_quantity            BIGINT NOT NULL DEFAULT 0 CHECK (included_quantity >= 0),
    consumed_quantity            BIGINT NOT NULL DEFAULT 0 CHECK (consumed_quantity >= 0),
    overage_quantity             BIGINT NOT NULL DEFAULT 0 CHECK (overage_quantity >= 0),
    last_reported_meter_event_id VARCHAR(255) NOT NULL DEFAULT '',
    last_synced_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_end > period_start),
    UNIQUE (owner_type, owner_id, metric_key, period_start, period_end)
);

CREATE INDEX idx_billing_usage_counters_owner_metric_period
    ON billing_usage_counters (owner_type, owner_id, metric_key, period_start DESC);

-- Linear integration (per-user Linear connection + repo mapping)
CREATE TABLE IF NOT EXISTS linear_integrations (
    id                       BIGSERIAL PRIMARY KEY,
    user_id                  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id                   BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
    linear_team_id           VARCHAR(255) NOT NULL,
    linear_team_name         VARCHAR(255) NOT NULL DEFAULT '',
    linear_team_key          VARCHAR(32) NOT NULL DEFAULT '',
    access_token_encrypted   BYTEA NOT NULL,
    refresh_token_encrypted  BYTEA,
    token_expires_at         TIMESTAMPTZ,
    webhook_secret           VARCHAR(255) NOT NULL,
    jjhub_repo_id            BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    jjhub_repo_owner         VARCHAR(255) NOT NULL,
    jjhub_repo_name          VARCHAR(255) NOT NULL,
    linear_actor_id          VARCHAR(255) NOT NULL DEFAULT '',
    is_active                BOOLEAN NOT NULL DEFAULT TRUE,
    last_sync_at             TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, linear_team_id, jjhub_repo_id)
);

CREATE INDEX idx_linear_integrations_user_id ON linear_integrations (user_id);
CREATE INDEX idx_linear_integrations_repo_id ON linear_integrations (jjhub_repo_id);
CREATE INDEX idx_linear_integrations_team_id ON linear_integrations (linear_team_id);
CREATE INDEX idx_linear_integrations_active ON linear_integrations (is_active) WHERE is_active = TRUE;

-- Linear issue mapping (JJHub issue ↔ Linear issue)
CREATE TABLE IF NOT EXISTS linear_issue_map (
    id                  BIGSERIAL PRIMARY KEY,
    integration_id      BIGINT NOT NULL REFERENCES linear_integrations(id) ON DELETE CASCADE,
    jjhub_issue_id      BIGINT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    jjhub_issue_number  BIGINT NOT NULL,
    linear_issue_id     VARCHAR(255) NOT NULL,
    linear_identifier   VARCHAR(64) NOT NULL DEFAULT '',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (integration_id, jjhub_issue_id),
    UNIQUE (integration_id, linear_issue_id)
);

CREATE INDEX idx_linear_issue_map_integration ON linear_issue_map (integration_id);
CREATE INDEX idx_linear_issue_map_jjhub_issue ON linear_issue_map (jjhub_issue_id);
CREATE INDEX idx_linear_issue_map_linear_issue ON linear_issue_map (linear_issue_id);

-- Linear comment mapping
CREATE TABLE IF NOT EXISTS linear_comment_map (
    id                  BIGSERIAL PRIMARY KEY,
    issue_map_id        BIGINT NOT NULL REFERENCES linear_issue_map(id) ON DELETE CASCADE,
    jjhub_comment_id    BIGINT NOT NULL,
    linear_comment_id   VARCHAR(255) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (issue_map_id, jjhub_comment_id),
    UNIQUE (issue_map_id, linear_comment_id)
);

CREATE INDEX idx_linear_comment_map_issue_map ON linear_comment_map (issue_map_id);

-- Linear sync operations (audit log + loop guard temporal dedup)
CREATE TABLE IF NOT EXISTS linear_sync_ops (
    id              BIGSERIAL PRIMARY KEY,
    integration_id  BIGINT NOT NULL REFERENCES linear_integrations(id) ON DELETE CASCADE,
    source          VARCHAR(16) NOT NULL CHECK (source IN ('jjhub', 'linear')),
    target          VARCHAR(16) NOT NULL CHECK (target IN ('jjhub', 'linear')),
    entity          VARCHAR(32) NOT NULL CHECK (entity IN ('issue', 'comment')),
    entity_id       VARCHAR(255) NOT NULL,
    action          VARCHAR(32) NOT NULL CHECK (action IN ('create', 'update', 'delete', 'close', 'reopen', 'initial_sync')),
    status          VARCHAR(16) NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'skipped')),
    error_message   TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_linear_sync_ops_integration ON linear_sync_ops (integration_id, created_at DESC);
CREATE INDEX idx_linear_sync_ops_dedup ON linear_sync_ops (integration_id, entity, entity_id, created_at DESC);

-- Persisted production canary results (e.g. Playwright UI canaries)
CREATE TABLE IF NOT EXISTS canary_results (
    id                BIGSERIAL PRIMARY KEY,
    suite             VARCHAR(32) NOT NULL,
    test_name         VARCHAR(128) NOT NULL,
    status            VARCHAR(16) NOT NULL CHECK (status IN ('success', 'failure')),
    duration_seconds  DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
    error_message     TEXT NOT NULL DEFAULT '',
    run_id            VARCHAR(128) NOT NULL DEFAULT '',
    reported_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (suite, test_name)
);

CREATE INDEX idx_canary_results_suite_reported
    ON canary_results (suite, reported_at DESC);

-- SSE tickets (short-lived, single-use tokens for EventSource connections)
CREATE TABLE IF NOT EXISTS sse_tickets (
    ticket_hash  VARCHAR(64) PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ NOT NULL,
    used_at      TIMESTAMPTZ
);

CREATE INDEX idx_sse_tickets_expires_at ON sse_tickets (expires_at);
CREATE INDEX idx_sse_tickets_user_id ON sse_tickets (user_id);

-- Issue artifacts (research, plans, review logs attached to issues)
CREATE TABLE IF NOT EXISTS issue_artifacts (
    id              BIGSERIAL PRIMARY KEY,
    repository_id   BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    issue_id        BIGINT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    step_name       VARCHAR(255) NOT NULL DEFAULT '',
    size            BIGINT NOT NULL DEFAULT 0 CHECK (size >= 0),
    content_type    VARCHAR(255) NOT NULL DEFAULT 'application/octet-stream',
    status          VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready')),
    gcs_key         TEXT NOT NULL,
    confirmed_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (issue_id, name)
);

CREATE INDEX idx_issue_artifacts_repo_id ON issue_artifacts (repository_id, created_at DESC);
CREATE INDEX idx_issue_artifacts_issue_id ON issue_artifacts (issue_id, created_at DESC);
CREATE INDEX idx_issue_artifacts_expires_at ON issue_artifacts (expires_at);

-- Sync queue for local-first daemon mode
CREATE TABLE IF NOT EXISTS _sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    method VARCHAR(8) NOT NULL,
    path TEXT NOT NULL,
    body JSONB,
    local_id TEXT,
    remote_id TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'conflict', 'failed')),
    error_message TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at TIMESTAMPTZ
);

CREATE INDEX idx_sync_queue_status ON _sync_queue (status, created_at);
