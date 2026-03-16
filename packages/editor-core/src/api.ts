/**
 * API client for JJHub editor integrations.
 *
 * Wraps fetch calls to the local JJHub daemon, providing typed methods
 * for all editor-relevant operations. Returns types from @jjhub/ui-core
 * for consistency across the UI surface.
 */

import { getToken, detectRepoContext, type RepoContext } from "./config";
import { getDaemonUrl } from "./daemon";

// ---- Response types (matching @jjhub/ui-core) ----

export type IssueSummary = {
  id: number;
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  author: { id: number; login: string };
  labels: Array<{ id: number; name: string; color: string; description: string }>;
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
  assignees: Array<{ id: number; login: string }>;
  labels: Array<{ id: number; name: string; color: string; description: string }>;
  milestone_id: number | null;
  comment_count: number;
  created_at: string;
  updated_at: string;
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

export type BookmarkResponse = {
  name: string;
  target_change_id: string;
  target_commit_id: string;
  is_tracking_remote: boolean;
  remote_name?: string;
};

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

export type SearchResult = {
  type: "issue" | "landing" | "change" | "repo";
  id: number | string;
  title: string;
  description?: string;
  url?: string;
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

export type SyncStatusResponse = {
  status: "online" | "offline" | "syncing" | "error";
  last_sync_at: string | null;
  pending_count: number;
  error_message?: string;
};

export type CreateIssueRequest = {
  title: string;
  body?: string;
  labels?: number[];
  assignees?: string[];
  milestone_id?: number;
};

export type ListOptions = {
  page?: number;
  limit?: number;
  state?: string;
  sort?: string;
  query?: string;
};

// ---- Client ----

export type EditorAPIClientOptions = {
  /** Daemon base URL. If not provided, resolved via getDaemonUrl(). */
  baseUrl?: string;
  /** Auth token. If not provided, resolved via getToken(). */
  token?: string;
  /** Repository context (owner/repo). If not provided, auto-detected from cwd. */
  repoContext?: RepoContext;
  /** Custom fetch implementation. Defaults to globalThis.fetch. */
  fetch?: typeof globalThis.fetch;
};

/**
 * API client for editor integrations.
 *
 * Provides typed methods for all editor-relevant JJHub daemon endpoints.
 * Handles auth token injection and repo-scoped path construction.
 */
export class EditorAPIClient {
  private baseUrl: string;
  private token: string | null;
  private repo: RepoContext | null;
  private fetchFn: typeof globalThis.fetch;

  constructor(options: EditorAPIClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? getDaemonUrl();
    this.token = options.token ?? getToken();
    this.repo = options.repoContext ?? detectRepoContext();
    this.fetchFn = options.fetch ?? globalThis.fetch;
  }

  /**
   * Update the auth token (e.g. after re-authentication).
   */
  setToken(token: string | null): void {
    this.token = token;
  }

  /**
   * Update the repository context.
   */
  setRepoContext(context: RepoContext | null): void {
    this.repo = context;
  }

  /**
   * Get the current repo context, throwing if none is set.
   */
  private requireRepo(): RepoContext {
    if (!this.repo) {
      throw new Error(
        "No repository context. Open a JJHub repository or set the repo context explicitly.",
      );
    }
    return this.repo;
  }

  /**
   * Make an authenticated request to the daemon.
   */
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (this.token && !headers.has("Authorization")) {
      headers.set("Authorization", `token ${this.token}`);
    }

    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const res = await this.fetchFn(url, { ...init, headers });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`JJHub API error ${res.status}: ${body || res.statusText}`);
    }

    return res.json() as Promise<T>;
  }

  /**
   * Build a repo-scoped API path.
   */
  private repoPath(suffix: string): string {
    const ctx = this.requireRepo();
    const base = `/api/repos/${encodeURIComponent(ctx.owner)}/${encodeURIComponent(ctx.repo)}`;
    return suffix ? `${base}${suffix.startsWith("/") ? suffix : `/${suffix}`}` : base;
  }

  private queryString(opts?: ListOptions): string {
    if (!opts) return "";
    const params = new URLSearchParams();
    if (opts.page != null) params.set("page", String(opts.page));
    if (opts.limit != null) params.set("limit", String(opts.limit));
    if (opts.state) params.set("state", opts.state);
    if (opts.sort) params.set("sort", opts.sort);
    if (opts.query) params.set("q", opts.query);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  // ---- Issues ----

  /**
   * List issues for the current repository.
   */
  async listIssues(opts?: ListOptions): Promise<IssueSummary[]> {
    const qs = this.queryString(opts);
    return this.request<IssueSummary[]>(this.repoPath(`/issues${qs}`));
  }

  /**
   * Create a new issue in the current repository.
   */
  async createIssue(data: CreateIssueRequest): Promise<IssueDetailResponse> {
    return this.request<IssueDetailResponse>(this.repoPath("/issues"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  // ---- Landing Requests ----

  /**
   * List landing requests for the current repository.
   */
  async listLandings(opts?: ListOptions): Promise<LandingSummary[]> {
    const qs = this.queryString(opts);
    return this.request<LandingSummary[]>(this.repoPath(`/landings${qs}`));
  }

  // ---- Bookmarks ----

  /**
   * List bookmarks (branches) for the current repository.
   */
  async listBookmarks(): Promise<BookmarkResponse[]> {
    return this.request<BookmarkResponse[]>(this.repoPath("/bookmarks"));
  }

  // ---- Changes ----

  /**
   * List recent changes for the current repository.
   */
  async listChanges(opts?: ListOptions): Promise<RepoChange[]> {
    const qs = this.queryString(opts);
    return this.request<RepoChange[]>(this.repoPath(`/changes${qs}`));
  }

  // ---- Search ----

  /**
   * Search across the current repository.
   */
  async search(query: string, opts?: Omit<ListOptions, "query">): Promise<SearchResult[]> {
    const qs = this.queryString({ ...opts, query });
    return this.request<SearchResult[]>(this.repoPath(`/search${qs}`));
  }

  // ---- Notifications ----

  /**
   * Get notifications for the authenticated user.
   */
  async getNotifications(opts?: ListOptions): Promise<NotificationsPage> {
    const qs = this.queryString(opts);
    return this.request<NotificationsPage>(`/api/notifications${qs}`);
  }

  // ---- Sync ----

  /**
   * Get the current sync status from the daemon.
   */
  async getSyncStatus(): Promise<SyncStatusResponse> {
    return this.request<SyncStatusResponse>("/api/sync/status");
  }

  /**
   * Force an immediate sync with the remote.
   */
  async forceSyncNow(): Promise<SyncStatusResponse> {
    return this.request<SyncStatusResponse>("/api/sync/now", {
      method: "POST",
    });
  }
}
