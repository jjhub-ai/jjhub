/**
 * Shared API response types used across web and terminal UIs.
 * These mirror the Go API server's JSON responses.
 */

// --- Repo ---

export type UserRepoSummary = {
    id: number;
    name: string;
    description: string;
    is_public: boolean;
    default_bookmark: string;
    created_at: string;
    updated_at: string;
};

export type SearchRepoResult = {
    id: number;
    owner: string;
    name: string;
    full_name: string;
    description: string;
    is_public: boolean;
    topics: string[];
};

export type UserRepoListPage = {
    total: number;
    items: UserRepoSummary[];
};

export type SearchRepoListPage = {
    total: number;
    items: SearchRepoResult[];
};

export type RepoResponse = {
    default_bookmark: string;
};

export type ContentEntry = {
    name: string;
    path: string;
    type: "file" | "dir";
    size: number;
};

export type RepoFileResponse = {
    content: string;
    encoding?: string;
};

export type BookmarkResponse = {
    name: string;
    target_change_id: string;
    target_commit_id: string;
    is_tracking_remote: boolean;
    remote_name?: string;
};

export type RepoBookmarksBundle = {
    repo: RepoResponse;
    bookmarks: BookmarkResponse[];
};

// --- Issues ---

export type IssueLabel = {
    id: number;
    name: string;
    color: string;
    description: string;
};

export type IssueSummary = {
    id: number;
    number: number;
    title: string;
    body: string;
    state: "open" | "closed";
    author: { id: number; login: string };
    labels: IssueLabel[];
    comment_count: number;
    created_at: string;
    updated_at: string;
};

export type IssueDetailResponse = {
    id: number;
    number: number;
    title: string;
    body: string;
    state: "open" | "closed";
    author: { id: number; login: string };
    assignees: { id: number; login: string }[];
    labels: IssueLabel[];
    milestone_id: number | null;
    comment_count: number;
    created_at: string;
    updated_at: string;
};

export type IssueCommentResponse = {
    id: number;
    issue_id: number;
    user_id: number;
    commenter: string;
    body: string;
    type: string;
    created_at: string;
    updated_at: string;
};

export type IssueDetailBundle = {
    issue: IssueDetailResponse;
    comments: IssueCommentResponse[];
};

// --- Landings ---

export type LandingSummary = {
    number: number;
    title: string;
    body: string;
    state: "open" | "merged" | "closed" | "draft";
    author: { id: number; login: string };
    change_ids: string[];
    target_bookmark: string;
    conflict_status: string;
    stack_size: number;
    created_at: string;
    updated_at: string;
};

type UserMeta = { id: number; login: string };

export type LandingDetail = {
    number: number;
    title: string;
    body: string;
    state: "open" | "closed" | "merged" | "draft";
    author: UserMeta;
    change_ids: string[];
    target_bookmark: string;
    conflict_status: string;
    stack_size: number;
    created_at: string;
    updated_at: string;
};

export type LandingComment = {
    id: number;
    landing_request_id: number;
    author: UserMeta;
    path: string;
    line: number;
    side: string;
    body: string;
    created_at: string;
    updated_at: string;
};

export type LandingReview = {
    id: number;
    landing_request_id: number;
    reviewer: UserMeta;
    type: "approve" | "comment" | "request_changes" | "pending";
    body: string;
    state: "submitted" | "dismissed";
    created_at: string;
    updated_at: string;
};

export type LandingChange = {
    id: number;
    landing_request_id: number;
    change_id: string;
    position_in_stack: number;
    created_at: string;
};

export type LandingDiffResponse = {
    landing_number: number;
    changes: {
        change_id: string;
        file_diffs: Array<{
            path: string;
            old_path?: string;
            change_type: string;
            patch: string;
            is_binary: boolean;
            language?: string;
            additions: number;
            deletions: number;
            old_content?: string;
            new_content?: string;
        }>;
    }[];
};

export type LandingDetailBundle = {
    landing: LandingDetail;
    comments: LandingComment[];
    reviews: LandingReview[];
    changes: LandingChange[];
};

// --- Changes ---

export type RepoChange = {
    change_id: string;
    commit_id: string;
    description: string;
    author_name: string;
    author_email: string;
    timestamp: string;
    has_conflict: boolean;
    is_empty: boolean;
    parent_change_ids: string[];
};

export type ChangeResponse = RepoChange;

// --- Notifications ---

export type Notification = {
    id: number;
    source_type: string;
    source_id: number | null;
    subject: string;
    body: string;
    status: string;
    read_at: string | null;
    created_at: string;
    updated_at: string;
};

export type NotificationsPage = {
    total: number;
    items: Notification[];
};

// --- Workflows ---

export type WorkflowDefinition = {
    id: number;
    name: string;
    path: string;
    config: unknown;
    is_active: boolean;
    updated_at: string;
};

export type WorkflowRun = {
    id: number;
    workflow_definition_id: number;
    status: "queued" | "running" | "success" | "failed" | "cancelled" | "timeout" | string;
    trigger_event: string;
    trigger_ref: string;
    trigger_commit_sha: string;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
};

export type WorkflowWithLatestRun = {
    workflow: WorkflowDefinition;
    latestRun: WorkflowRun | null;
};

export type WorkflowDefinitionsBundle = {
    workflows: WorkflowWithLatestRun[];
    workflowNames: Array<[number, string]>;
};

// --- User ---

export type CurrentUser = {
    id: number;
    login: string;
    full_name?: string;
    email?: string;
    avatar_url?: string;
    is_admin?: boolean;
    created_at?: string;
};

// --- Agent messages ---

export type AgentMessagePart = {
    part_index?: number;
    type: string;
    content: unknown;
};

export type PersistedAgentMessage = {
    id: number | string;
    role: string;
    created_at: string;
    parts?: AgentMessagePart[];
    content?: string;
    tool_calls?: Array<{
        function?: {
            name?: string;
            arguments?: string;
        };
    }>;
    token_count?: number;
};

export type NormalizedAgentMessage = {
    text: string;
    toolName: string;
    type: "text" | "tool_call" | "tool_result";
};

// --- Repo context ---

export type RepoContext = {
    owner: string;
    repo: string;
};

// --- Feature flags ---

export type FeatureFlags = {
    readout_dashboard: boolean;
    landing_queue: boolean;
    tool_skills: boolean;
    tool_policies: boolean;
    repo_snapshots: boolean;
    integrations: boolean;
    session_replay: boolean;
    secrets_manager: boolean;
    web_editor: boolean;
    client_error_reporting: boolean;
    client_metrics: boolean;
};
