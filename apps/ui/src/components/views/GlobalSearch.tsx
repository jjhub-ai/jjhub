import { createSignal, onMount, For, Show, Switch, Match, batch } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import {
    Search,
    Book,
    CircleDot,
    Code2,
    Users,
    Globe,
    Lock,
    CheckCircle2,
    FileCode,
    ChevronLeft,
    ChevronRight,
    AlertCircle,
} from "lucide-solid";
import { apiFetch } from "../../lib/repoContext";
import { useSearchFocusTarget } from "../../lib/keyboard";
import PrefetchLink from "../PrefetchLink";
import {
    issueDetailResource,
    repoContentsResource,
    repoFileResource,
} from "../../lib/navigationData";
import "./GlobalSearch.css";

// ── Types ────────────────────────────────────────────────────────────────────

type SearchTab = "repositories" | "issues" | "code" | "users";

type RepositoryResult = {
    id: number;
    owner: string;
    name: string;
    full_name: string;
    description: string;
    is_public: boolean;
    topics: string[] | null;
};

type IssueResult = {
    id: number;
    repository_id: number;
    repository_owner: string;
    repository_name: string;
    number: number;
    title: string;
    state: string;
};

type CodeResult = {
    repository_id: number;
    repository_owner: string;
    repository_name: string;
    path: string;
    snippet: string;
};

function codeResultHref(result: CodeResult): string {
    const params = new URLSearchParams({
        path: result.path,
    });
    return `/${result.repository_owner}/${result.repository_name}/code?${params.toString()}`;
}

type UserResult = {
    id: number;
    username: string;
    display_name: string;
    avatar_url: string;
};

type SearchResultPage<T> = {
    items: T[];
    total_count: number;
    page: number;
    per_page: number;
};

type TabState<T> = {
    items: T[];
    totalCount: number;
    page: number;
    isLoading: boolean;
    error: string | null;
    /** The query that was used to fetch the cached data. Invalidate if query changes. */
    cachedQuery: string;
    /** Extra param cache key for issues filters */
    cachedExtra: string;
};

const PER_PAGE = 20;

function emptyTabState<T>(): TabState<T> {
    return {
        items: [],
        totalCount: 0,
        page: 1,
        isLoading: false,
        error: null,
        cachedQuery: "",
        cachedExtra: "",
    };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function GlobalSearch() {
    const [searchParams, setSearchParams] = useSearchParams<{ q?: string; type?: string; page?: string; state?: string }>();

    // Derive initial values from URL
    const initialQuery = searchParams.q ?? "";
    const initialTab = (["repositories", "issues", "code", "users"].includes(searchParams.type ?? "") ? searchParams.type : "repositories") as SearchTab;
    const initialPage = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
    const initialIssueState = (["open", "closed"].includes(searchParams.state ?? "") ? searchParams.state : "") as string;

    const [query, setQuery] = createSignal(initialQuery);
    const [activeTab, setActiveTab] = createSignal<SearchTab>(initialTab);
    const [issueStateFilter, setIssueStateFilter] = createSignal(initialIssueState);

    // Per-tab state
    const [repoState, setRepoState] = createSignal<TabState<RepositoryResult>>(emptyTabState());
    const [issueState, setIssueState] = createSignal<TabState<IssueResult>>(emptyTabState());
    const [codeState, setCodeState] = createSignal<TabState<CodeResult>>(emptyTabState());
    const [userState, setUserState] = createSignal<TabState<UserResult>>(emptyTabState());

    // Debounce timer
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    // Input ref for auto-focus
    let inputRef: HTMLInputElement | undefined;

    onMount(() => {
        inputRef?.focus();
        // If there's an initial query from the URL, fire search immediately
        if (initialQuery.trim()) {
            fetchActiveTab(initialQuery.trim(), initialTab, initialPage);
        }
    });

    useSearchFocusTarget(() => inputRef?.focus());

    // ── State getters/setters by tab ─────────────────────────────────────────

    function getTabState(tab: SearchTab) {
        switch (tab) {
            case "repositories": return repoState();
            case "issues": return issueState();
            case "code": return codeState();
            case "users": return userState();
        }
    }

    function setTabState(tab: SearchTab, updater: (prev: TabState<any>) => TabState<any>) {
        switch (tab) {
            case "repositories": setRepoState(updater as any); break;
            case "issues": setIssueState(updater as any); break;
            case "code": setCodeState(updater as any); break;
            case "users": setUserState(updater as any); break;
        }
    }

    function activeTabState() {
        return getTabState(activeTab());
    }

    function totalPages() {
        const state = activeTabState();
        if (state.totalCount <= 0) return 1;
        return Math.ceil(state.totalCount / PER_PAGE);
    }

    function currentPage() {
        return activeTabState().page;
    }

    // ── Extra key for cache invalidation (issues filters) ────────────────────

    function issueExtraKey() {
        return `state=${issueStateFilter()}`;
    }

    // ── URL sync ─────────────────────────────────────────────────────────────

    function syncURL(q: string, tab: SearchTab, page: number) {
        const params: Record<string, string | undefined> = {
            q: q || undefined,
            type: tab,
            page: page > 1 ? String(page) : undefined,
        };
        if (tab === "issues" && issueStateFilter()) {
            params.state = issueStateFilter();
        } else {
            params.state = undefined;
        }
        setSearchParams(params, { replace: true });
    }

    // ── Fetch logic ──────────────────────────────────────────────────────────

    async function fetchActiveTab(q: string, tab: SearchTab, page: number) {
        if (!q.trim()) return;

        const extra = tab === "issues" ? issueExtraKey() : "";
        const current = getTabState(tab);
        // If already cached for this query, page, and extra, skip
        if (current.cachedQuery === q && current.page === page && current.cachedExtra === extra && current.items.length > 0 && !current.error) {
            return;
        }

        setTabState(tab, (prev) => ({ ...prev, isLoading: true, error: null, page }));

        let url = `/api/search/${tab}?q=${encodeURIComponent(q)}&page=${page}&per_page=${PER_PAGE}`;
        if (tab === "issues" && issueStateFilter()) {
            url += `&state=${encodeURIComponent(issueStateFilter())}`;
        }

        try {
            const res = await apiFetch(url);
            if (!res.ok) {
                const body = await res.text();
                let message = `Search failed (${res.status})`;
                try {
                    const parsed = JSON.parse(body);
                    if (parsed.message) message = parsed.message;
                } catch { /* ignore */ }
                setTabState(tab, (prev) => ({ ...prev, isLoading: false, error: message, cachedQuery: q, cachedExtra: extra }));
                return;
            }
            const data: SearchResultPage<any> = await res.json();
            setTabState(tab, () => ({
                items: data.items ?? [],
                totalCount: data.total_count,
                page: data.page,
                isLoading: false,
                error: null,
                cachedQuery: q,
                cachedExtra: extra,
            }));
        } catch (err) {
            const message = err instanceof Error ? err.message : "Network error";
            setTabState(tab, (prev) => ({ ...prev, isLoading: false, error: message, cachedQuery: q, cachedExtra: extra }));
        }
    }

    // ── Input handler with debounce ──────────────────────────────────────────

    function handleInput(value: string) {
        setQuery(value);
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const q = value.trim();
            if (!q) {
                // Clear all tabs
                batch(() => {
                    setRepoState(emptyTabState);
                    setIssueState(emptyTabState);
                    setCodeState(emptyTabState);
                    setUserState(emptyTabState);
                });
                syncURL("", activeTab(), 1);
                return;
            }
            // Invalidate all cached queries since the term changed
            batch(() => {
                setRepoState((p) => ({ ...p, cachedQuery: "" }));
                setIssueState((p) => ({ ...p, cachedQuery: "" }));
                setCodeState((p) => ({ ...p, cachedQuery: "" }));
                setUserState((p) => ({ ...p, cachedQuery: "" }));
            });
            syncURL(q, activeTab(), 1);
            fetchActiveTab(q, activeTab(), 1);
        }, 400);
    }

    function handleTabChange(tab: SearchTab) {
        setActiveTab(tab);
        const q = query().trim();
        syncURL(q, tab, 1);
        if (q) {
            fetchActiveTab(q, tab, 1);
        }
    }

    function handlePageChange(newPage: number) {
        const q = query().trim();
        if (!q) return;
        // Invalidate cache for active tab so it re-fetches the new page
        setTabState(activeTab(), (p) => ({ ...p, cachedQuery: "" }));
        syncURL(q, activeTab(), newPage);
        fetchActiveTab(q, activeTab(), newPage);
    }

    function handleIssueStateChange(state: string) {
        setIssueStateFilter(state);
        const q = query().trim();
        if (!q) return;
        setIssueState((p) => ({ ...p, cachedQuery: "" }));
        // Wait a tick for the signal to settle before building the extra key
        setTimeout(() => {
            syncURL(q, "issues", 1);
            fetchActiveTab(q, "issues", 1);
        }, 0);
    }

    function handleRetry() {
        const q = query().trim();
        if (!q) return;
        setTabState(activeTab(), (p) => ({ ...p, cachedQuery: "", error: null }));
        fetchActiveTab(q, activeTab(), currentPage());
    }

    // ── Tab labels with counts ───────────────────────────────────────────────

    function tabLabel(tab: SearchTab): string {
        switch (tab) {
            case "repositories": return "Repositories";
            case "issues": return "Issues";
            case "code": return "Code";
            case "users": return "Users";
        }
    }

    function tabCount(tab: SearchTab): number | null {
        const state = getTabState(tab);
        if (state.cachedQuery !== query().trim()) return null;
        if (state.totalCount < 0) return null;
        return state.totalCount;
    }

    const tabs: SearchTab[] = ["repositories", "issues", "code", "users"];

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div class="search-view bg-app text-primary">
            {/* Search input */}
            <div class="search-header animate-in stagger-1">
                <div class="search-input-wrapper">
                    <Search size={18} class="search-icon" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search repositories, issues, code, and users..."
                        value={query()}
                        onInput={(e) => handleInput(e.currentTarget.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                if (debounceTimer) clearTimeout(debounceTimer);
                                const q = query().trim();
                                if (q) {
                                    batch(() => {
                                        setRepoState((p) => ({ ...p, cachedQuery: "" }));
                                        setIssueState((p) => ({ ...p, cachedQuery: "" }));
                                        setCodeState((p) => ({ ...p, cachedQuery: "" }));
                                        setUserState((p) => ({ ...p, cachedQuery: "" }));
                                    });
                                    syncURL(q, activeTab(), 1);
                                    fetchActiveTab(q, activeTab(), 1);
                                }
                            }
                        }}
                    />
                </div>
            </div>

            {/* Tabs */}
            <div class="search-tabs animate-in stagger-2">
                <For each={tabs}>
                    {(tab) => (
                        <button
                            class={`search-tab ${activeTab() === tab ? "active" : ""}`}
                            onClick={() => handleTabChange(tab)}
                        >
                            <Switch>
                                <Match when={tab === "repositories"}><Book size={15} /></Match>
                                <Match when={tab === "issues"}><CircleDot size={15} /></Match>
                                <Match when={tab === "code"}><Code2 size={15} /></Match>
                                <Match when={tab === "users"}><Users size={15} /></Match>
                            </Switch>
                            {tabLabel(tab)}
                            <Show when={tabCount(tab) !== null}>
                                <span class="tab-count">{tabCount(tab)}</span>
                            </Show>
                        </button>
                    )}
                </For>
            </div>

            {/* Results area */}
            <div class="search-results animate-in stagger-3">
                {/* Initial state: no query */}
                <Show when={!query().trim()}>
                    <div class="search-state-box">
                        <Search size={40} class="state-icon" />
                        <p class="state-heading">Search JJHub</p>
                        <p>Search across repositories, issues, code, and users.</p>
                    </div>
                </Show>

                {/* Query entered: show results for active tab */}
                <Show when={query().trim()}>
                    {/* Issues filter bar */}
                    <Show when={activeTab() === "issues"}>
                        <div class="issues-filter-bar">
                            <label>State:</label>
                            <select
                                value={issueStateFilter()}
                                onChange={(e) => handleIssueStateChange(e.currentTarget.value)}
                            >
                                <option value="">All</option>
                                <option value="open">Open</option>
                                <option value="closed">Closed</option>
                            </select>
                        </div>
                    </Show>

                    {/* Loading */}
                    <Show when={activeTabState().isLoading}>
                        <div class="search-state-box">
                            <div class="search-spinner" />
                            <p>Searching...</p>
                        </div>
                    </Show>

                    {/* Error */}
                    <Show when={!activeTabState().isLoading && activeTabState().error}>
                        <div class="search-state-box">
                            <AlertCircle size={36} class="state-icon" style={{ color: "var(--accent-red)" }} />
                            <p class="state-heading" style={{ color: "var(--accent-red)" }}>Search failed</p>
                            <p>{activeTabState().error}</p>
                            <button class="retry-btn" onClick={handleRetry}>Retry</button>
                        </div>
                    </Show>

                    {/* Empty results */}
                    <Show when={!activeTabState().isLoading && !activeTabState().error && activeTabState().cachedQuery === query().trim() && activeTabState().items.length === 0}>
                        <div class="search-state-box">
                            <Search size={36} class="state-icon" />
                            <p class="state-heading">No results found</p>
                            <p>No {tabLabel(activeTab()).toLowerCase()} matched '{query().trim()}'</p>
                        </div>
                    </Show>

                    {/* Results present */}
                    <Show when={!activeTabState().isLoading && !activeTabState().error && activeTabState().items.length > 0}>
                        <div class="search-results-summary">
                            Found {activeTabState().totalCount.toLocaleString()} {tabLabel(activeTab()).toLowerCase()}
                        </div>

                        <div class="search-results-list">
                            <Switch>
                                <Match when={activeTab() === "repositories"}>
                                    <For each={repoState().items}>
                                        {(repo) => (
                                            <PrefetchLink
                                                href={`/${repo.owner}/${repo.name}/code`}
                                                class="search-result-item"
                                                prefetch={() => repoContentsResource.prefetch({ owner: repo.owner, repo: repo.name }, "")}
                                            >
                                                <div class="search-result-icon">
                                                    <Show when={repo.is_public} fallback={<Lock size={16} />}>
                                                        <Globe size={16} />
                                                    </Show>
                                                </div>
                                                <div class="search-result-body">
                                                    <div class="search-result-title">{repo.full_name}</div>
                                                    <Show when={repo.description}>
                                                        <div class="search-result-desc">{repo.description}</div>
                                                    </Show>
                                                    <div class="search-result-meta">
                                                        <Show when={repo.is_public} fallback={<span class="badge-private">Private</span>}>
                                                            <span class="badge-public">Public</span>
                                                        </Show>
                                                        <Show when={repo.topics && repo.topics.length > 0}>
                                                            <For each={repo.topics!}>
                                                                {(topic) => <span class="topic-tag">{topic}</span>}
                                                            </For>
                                                        </Show>
                                                    </div>
                                                </div>
                                            </PrefetchLink>
                                        )}
                                    </For>
                                </Match>

                                <Match when={activeTab() === "issues"}>
                                    <For each={issueState().items}>
                                        {(issue) => (
                                            <PrefetchLink
                                                href={`/${issue.repository_owner}/${issue.repository_name}/issues/${issue.number}`}
                                                class="search-result-item"
                                                prefetch={() => issueDetailResource.prefetch(
                                                    { owner: issue.repository_owner, repo: issue.repository_name },
                                                    String(issue.number),
                                                )}
                                            >
                                                <div class="search-result-icon">
                                                    <Show when={issue.state === "open"} fallback={<CheckCircle2 size={16} style={{ color: "var(--accent-purple)" }} />}>
                                                        <CircleDot size={16} style={{ color: "var(--accent-green)" }} />
                                                    </Show>
                                                </div>
                                                <div class="search-result-body">
                                                    <div class="search-result-title">
                                                        <span style={{ color: "var(--text-muted)", "font-weight": "400" }}>{issue.repository_owner}/{issue.repository_name}#{issue.number}</span>{" "}
                                                        {issue.title}
                                                    </div>
                                                    <div class="search-result-meta">
                                                        <Show when={issue.state === "open"} fallback={<span class="badge-closed">Closed</span>}>
                                                            <span class="badge-open">Open</span>
                                                        </Show>
                                                    </div>
                                                </div>
                                            </PrefetchLink>
                                        )}
                                    </For>
                                </Match>

                                <Match when={activeTab() === "code"}>
                                    <For each={codeState().items}>
                                        {(result) => (
                                            <PrefetchLink
                                                href={codeResultHref(result)}
                                                class="search-result-item"
                                                prefetch={() => repoFileResource.prefetch(
                                                    { owner: result.repository_owner, repo: result.repository_name },
                                                    result.path,
                                                )}
                                            >
                                                <div class="search-result-icon">
                                                    <FileCode size={16} />
                                                </div>
                                                <div class="search-result-body">
                                                    <div class="search-result-title">
                                                        <span style={{ color: "var(--text-muted)", "font-weight": "400" }}>{result.repository_owner}/{result.repository_name}:</span>{" "}
                                                        {result.path}
                                                    </div>
                                                    <Show when={result.snippet}>
                                                        <div class="code-snippet">{result.snippet}</div>
                                                    </Show>
                                                </div>
                                            </PrefetchLink>
                                        )}
                                    </For>
                                </Match>

                                <Match when={activeTab() === "users"}>
                                    <For each={userState().items}>
                                        {(user) => (
                                            <PrefetchLink href={`/users/${user.username}`} class="search-result-item">
                                                <Show
                                                    when={user.avatar_url}
                                                    fallback={
                                                        <div class="user-avatar-fallback">
                                                            {user.username.charAt(0).toUpperCase()}
                                                        </div>
                                                    }
                                                >
                                                    <img
                                                        src={user.avatar_url}
                                                        alt={user.username}
                                                        class="user-avatar-img"
                                                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                                    />
                                                </Show>
                                                <div class="search-result-body">
                                                    <div class="search-result-title">{user.username}</div>
                                                    <Show when={user.display_name && user.display_name !== user.username}>
                                                        <div class="search-result-desc">{user.display_name}</div>
                                                    </Show>
                                                </div>
                                            </PrefetchLink>
                                        )}
                                    </For>
                                </Match>
                            </Switch>
                        </div>

                        {/* Pagination */}
                        <Show when={totalPages() > 1}>
                            <div class="search-pagination">
                                <button
                                    disabled={currentPage() <= 1}
                                    onClick={() => handlePageChange(currentPage() - 1)}
                                >
                                    <ChevronLeft size={14} style={{ display: "inline", "vertical-align": "middle" }} /> Previous
                                </button>
                                <span class="page-info">
                                    Page {currentPage()} of {totalPages()}
                                </span>
                                <button
                                    disabled={currentPage() >= totalPages()}
                                    onClick={() => handlePageChange(currentPage() + 1)}
                                >
                                    Next <ChevronRight size={14} style={{ display: "inline", "vertical-align": "middle" }} />
                                </button>
                            </div>
                        </Show>
                    </Show>
                </Show>
            </div>
        </div>
    );
}
