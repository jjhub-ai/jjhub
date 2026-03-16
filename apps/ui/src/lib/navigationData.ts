import type { ChangeResponse } from "../types/change";
import { apiFetch, repoApiFetch, type RepoContext } from "./repoContext";
import { createPrefetchResource } from "./prefetchCache";

const DEFAULT_PER_PAGE = 30;
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

export type RepoResponse = {
    default_bookmark: string;
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

function encodeRepoPath(path: string): string {
    return path
        .split("/")
        .filter(Boolean)
        .map(encodeURIComponent)
        .join("/");
}

function contextKey(context: RepoContext): string {
    return `${encodeURIComponent(context.owner)}/${encodeURIComponent(context.repo)}`;
}

function buildContentsRequest(path: string, ref?: string): string {
    const suffix = path ? `/contents/${encodeRepoPath(path)}` : "/contents";
    if (!ref) {
        return suffix;
    }
    return `${suffix}?${new URLSearchParams({ ref }).toString()}`;
}

export const userReposResource = createPrefetchResource({
    key: (page: number) => `route:repos?page=${page}`,
    load: async (signal, page: number): Promise<UserRepoListPage> => {
        const params = new URLSearchParams({
            page: String(page),
            per_page: String(DEFAULT_PER_PAGE),
        });
        const response = await apiFetch(`/api/user/repos?${params.toString()}`, { signal });
        if (!response.ok) {
            const body = await response.json().catch(() => null);
            throw new Error(body?.message || `Failed to load repositories (${response.status})`);
        }

        const total = parseInt(response.headers.get("X-Total-Count") || "0", 10);
        const items = (await response.json()) as UserRepoSummary[];
        return {
            total,
            items: Array.isArray(items) ? items : [],
        };
    },
});

export const searchReposResource = createPrefetchResource({
    key: (query: string, page: number) => `route:repos:search?q=${encodeURIComponent(query)}&page=${page}`,
    load: async (signal, query: string, page: number): Promise<SearchRepoListPage> => {
        const params = new URLSearchParams({
            q: query,
            page: String(page),
            per_page: String(DEFAULT_PER_PAGE),
        });
        const response = await apiFetch(`/api/search/repositories?${params.toString()}`, { signal });
        if (!response.ok) {
            const body = await response.json().catch(() => null);
            throw new Error(body?.message || `Search failed (${response.status})`);
        }

        const total = parseInt(response.headers.get("X-Total-Count") || "0", 10);
        const body = (await response.json()) as { items: SearchRepoResult[]; total_count: number };
        return {
            total: total || body.total_count || 0,
            items: Array.isArray(body.items) ? body.items : [],
        };
    },
});

export const issuesListResource = createPrefetchResource({
    key: (context: RepoContext) => `route:issues:${contextKey(context)}`,
    load: async (signal, context: RepoContext): Promise<IssueSummary[]> => {
        const response = await repoApiFetch("/issues?per_page=100", { signal }, context);
        if (!response.ok) {
            throw new Error(`Failed to load issues (${response.status})`);
        }

        const body = await response.json();
        return Array.isArray(body) ? (body as IssueSummary[]) : [];
    },
});

export const issueDetailResource = createPrefetchResource({
    key: (context: RepoContext, issueNumber: string) => `route:issue:${contextKey(context)}:${issueNumber}`,
    load: async (signal, context: RepoContext, issueNumber: string): Promise<IssueDetailBundle> => {
        const [issueResponse, commentsResponse] = await Promise.all([
            repoApiFetch(`/issues/${issueNumber}`, { signal }, context),
            repoApiFetch(`/issues/${issueNumber}/comments?per_page=100`, { signal }, context),
        ]);

        if (!issueResponse.ok) {
            throw new Error(`Failed to load issue (${issueResponse.status})`);
        }
        if (!commentsResponse.ok) {
            throw new Error(`Failed to load comments (${commentsResponse.status})`);
        }

        return {
            issue: (await issueResponse.json()) as IssueDetailResponse,
            comments: (await commentsResponse.json()) as IssueCommentResponse[],
        };
    },
});

export const landingsListResource = createPrefetchResource({
    key: (context: RepoContext) => `route:landings:${contextKey(context)}`,
    load: async (signal, context: RepoContext): Promise<LandingSummary[]> => {
        const response = await repoApiFetch("/landings?per_page=100", { signal }, context);
        if (!response.ok) {
            throw new Error(`Failed to load landing requests (${response.status})`);
        }

        const body = await response.json();
        return Array.isArray(body) ? (body as LandingSummary[]) : [];
    },
});

export const landingDetailResource = createPrefetchResource({
    key: (context: RepoContext, landingNumber: string) => `route:landing:${contextKey(context)}:${landingNumber}`,
    load: async (signal, context: RepoContext, landingNumber: string): Promise<LandingDetailBundle> => {
        const [landingResponse, commentsResponse, reviewsResponse, changesResponse] = await Promise.all([
            repoApiFetch(`/landings/${landingNumber}`, { signal }, context),
            repoApiFetch(`/landings/${landingNumber}/comments?per_page=100`, { signal }, context),
            repoApiFetch(`/landings/${landingNumber}/reviews?per_page=100`, { signal }, context),
            repoApiFetch(`/landings/${landingNumber}/changes?per_page=100`, { signal }, context),
        ]);

        if (!landingResponse.ok) {
            throw new Error(`Failed to load landing request (${landingResponse.status})`);
        }
        if (!commentsResponse.ok || !reviewsResponse.ok || !changesResponse.ok) {
            throw new Error("Failed to load landing metadata");
        }

        return {
            landing: (await landingResponse.json()) as LandingDetail,
            comments: (await commentsResponse.json()) as LandingComment[],
            reviews: (await reviewsResponse.json()) as LandingReview[],
            changes: (await changesResponse.json()) as LandingChange[],
        };
    },
});

export const landingDiffResource = createPrefetchResource({
    key: (context: RepoContext, landingNumber: string, whitespaceMode: "show" | "ignore" = "show") =>
        `route:landing:diff:${contextKey(context)}:${landingNumber}:${whitespaceMode}`,
    load: async (
        signal,
        context: RepoContext,
        landingNumber: string,
        whitespaceMode: "show" | "ignore" = "show",
    ): Promise<LandingDiffResponse> => {
        const suffix = whitespaceMode === "ignore" ? "?whitespace=ignore" : "";
        const response = await repoApiFetch(`/landings/${landingNumber}/diff${suffix}`, { signal }, context);
        if (!response.ok) {
            throw new Error(`Failed to load landing diff (${response.status})`);
        }

        return (await response.json()) as LandingDiffResponse;
    },
});

export const repoContentsResource = createPrefetchResource({
    key: (context: RepoContext, path: string, ref: string = "") =>
        `route:repo:contents:${contextKey(context)}:${encodeURIComponent(ref)}:${encodeURIComponent(path)}`,
    load: async (signal, context: RepoContext, path: string, ref: string = ""): Promise<ContentEntry[]> => {
        const response = await repoApiFetch(buildContentsRequest(path, ref || undefined), { signal }, context);
        if (!response.ok) {
            throw new Error(
                response.status === 404
                    ? (path === "" ? "Repository has no content." : `Path not found: ${path}`)
                    : `Failed to load contents (${response.status})`,
            );
        }

        const body = await response.json();
        return Array.isArray(body) ? (body as ContentEntry[]) : [];
    },
});

export const repoFileResource = createPrefetchResource({
    key: (context: RepoContext, path: string, ref: string = "") =>
        `route:repo:file:${contextKey(context)}:${encodeURIComponent(ref)}:${encodeURIComponent(path)}`,
    load: async (signal, context: RepoContext, path: string, ref: string = ""): Promise<RepoFileResponse> => {
        const response = await repoApiFetch(buildContentsRequest(path, ref || undefined), { signal }, context);
        if (!response.ok) {
            throw new Error(response.status === 404 ? `File not found: ${path}` : `Failed to load file (${response.status})`);
        }

        return (await response.json()) as RepoFileResponse;
    },
});

export const repoChangesResource = createPrefetchResource({
    key: (context: RepoContext) => `route:changes:${contextKey(context)}`,
    load: async (signal, context: RepoContext): Promise<ChangeResponse[]> => {
        const response = await repoApiFetch("/changes?per_page=100", { signal }, context);
        if (!response.ok) {
            throw new Error(`Failed to load changes (${response.status})`);
        }

        const body = await response.json();
        return Array.isArray(body) ? (body as ChangeResponse[]) : ((body.items ?? []) as ChangeResponse[]);
    },
});

export const repoBookmarksResource = createPrefetchResource({
    key: (context: RepoContext) => `route:bookmarks:${contextKey(context)}`,
    load: async (signal, context: RepoContext): Promise<RepoBookmarksBundle> => {
        const [repoResponse, bookmarksResponse] = await Promise.all([
            repoApiFetch("", { signal }, context),
            repoApiFetch("/bookmarks?per_page=100", { signal }, context),
        ]);

        if (!repoResponse.ok || !bookmarksResponse.ok) {
            throw new Error("Failed to load bookmarks");
        }

        const bookmarks = await bookmarksResponse.json();
        return {
            repo: (await repoResponse.json()) as RepoResponse,
            bookmarks: Array.isArray(bookmarks) ? (bookmarks as BookmarkResponse[]) : ((bookmarks.items ?? []) as BookmarkResponse[]),
        };
    },
});

export const workflowDefinitionsResource = createPrefetchResource({
    key: (context: RepoContext) => `route:workflows:${contextKey(context)}`,
    load: async (signal, context: RepoContext): Promise<WorkflowDefinitionsBundle> => {
        const workflowResponse = await repoApiFetch("/workflows?per_page=100", { signal }, context);
        if (!workflowResponse.ok) {
            throw new Error(`Failed to load workflows (${workflowResponse.status})`);
        }

        const body = (await workflowResponse.json()) as { workflows: WorkflowDefinition[] };
        const definitions = Array.isArray(body.workflows) ? body.workflows : [];
        const workflowNames = definitions.map((workflow) => [workflow.id, workflow.name] as [number, string]);

        const workflows = await Promise.all(
            definitions.map(async (workflow) => {
                const runsResponse = await repoApiFetch(`/workflows/${workflow.id}/runs?per_page=1`, { signal }, context);
                if (!runsResponse.ok) {
                    return { workflow, latestRun: null };
                }

                const runsBody = (await runsResponse.json()) as { workflow_runs: WorkflowRun[] };
                return {
                    workflow,
                    latestRun: Array.isArray(runsBody.workflow_runs) ? runsBody.workflow_runs[0] ?? null : null,
                };
            }),
        );

        return {
            workflows,
            workflowNames,
        };
    },
});

export const inboxNotificationsResource = createPrefetchResource({
    key: (page: number) => `route:inbox?page=${page}`,
    load: async (signal, page: number): Promise<NotificationsPage> => {
        const response = await apiFetch(`/api/notifications/list?page=${page}&per_page=${DEFAULT_PER_PAGE}`, { signal });
        if (!response.ok) {
            const body = await response.json().catch(() => null);
            throw new Error(body?.message || `Failed to fetch notifications (${response.status})`);
        }

        return {
            total: parseInt(response.headers.get("X-Total-Count") || "0", 10),
            items: (await response.json()) as Notification[],
        };
    },
});
