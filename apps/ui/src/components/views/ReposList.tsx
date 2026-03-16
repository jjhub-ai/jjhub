import { createSignal, createEffect, on, For, onCleanup, Show } from "solid-js";
import { Book, Plus, Lock, Globe, Search, CheckCircle2, X } from "lucide-solid";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { apiFetch } from "../../lib/repoContext";
import { useAuth } from "../../layouts/AppLayout";
import { useListNavigation, useSearchFocusTarget } from "../../lib/keyboard";
import ShortcutBadge from "../keyboard/ShortcutBadge";

/**
 * Shape returned by GET /api/user/repos (array items).
 * The authenticated user's repos endpoint returns a flat array with these fields.
 */
type UserRepoSummary = {
    id: number;
    name: string;
    description: string;
    is_public: boolean;
    default_bookmark: string;
    created_at: string;
    updated_at: string;
};

/**
 * Shape returned by GET /api/search/repositories (inside .items[]).
 */
type SearchRepoResult = {
    id: number;
    owner: string;
    name: string;
    full_name: string;
    description: string;
    is_public: boolean;
    topics: string[];
};

/** Unified shape used by the component for rendering. */
type RepoItem = {
    id: number;
    owner: string;
    name: string;
    description: string;
    isPrivate: boolean;
    updatedAt: string | null;
};

const DEFAULT_PER_PAGE = 30;

function formatRelativeTime(timestamp: string | null): string {
    if (!timestamp) return "";
    const parsed = Date.parse(timestamp);
    if (Number.isNaN(parsed)) return "recently";
    const diffMs = Date.now() - parsed;
    const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
}

export default function ReposList() {
    const { user, isLoading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const deletedParam = () => Array.isArray(searchParams.deleted) ? searchParams.deleted[0] ?? null : searchParams.deleted ?? null;
    const [deletedRepo, setDeletedRepo] = createSignal<string | null>(deletedParam());
    const [repos, setRepos] = createSignal<RepoItem[]>([]);
    const [isLoading, setIsLoading] = createSignal(true);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [searchQuery, setSearchQuery] = createSignal("");
    const [page, setPage] = createSignal(1);
    const [totalCount, setTotalCount] = createSignal(0);
    let searchInputRef: HTMLInputElement | undefined;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    // Clear deleted query param from URL but keep the banner visible
    createEffect(() => {
        if (deletedParam()) {
            setSearchParams({ deleted: undefined }, { replace: true });
        }
    });

    onCleanup(() => {
        if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    });

    const totalPages = () => {
        const count = totalCount();
        if (count <= 0) return 1;
        return Math.ceil(count / DEFAULT_PER_PAGE);
    };

    /** Fetch the authenticated user's repos (no search query). */
    async function fetchUserRepos(pageNum: number) {
        const params = new URLSearchParams({
            page: String(pageNum),
            per_page: String(DEFAULT_PER_PAGE),
        });
        const res = await apiFetch(`/api/user/repos?${params.toString()}`);
        if (!res.ok) {
            const body = await res.json().catch(() => null);
            throw new Error(body?.message || `Failed to load repositories (${res.status})`);
        }

        const total = parseInt(res.headers.get("X-Total-Count") || "0", 10);
        const items: UserRepoSummary[] = await res.json();
        const username = user()?.username ?? "";

        return {
            total,
            items: items.map((r): RepoItem => ({
                id: r.id,
                owner: username,
                name: r.name,
                description: r.description,
                isPrivate: !r.is_public,
                updatedAt: r.updated_at,
            })),
        };
    }

    /** Search repos via the search endpoint. */
    async function fetchSearchRepos(query: string, pageNum: number) {
        const params = new URLSearchParams({
            q: query,
            page: String(pageNum),
            per_page: String(DEFAULT_PER_PAGE),
        });
        const res = await apiFetch(`/api/search/repositories?${params.toString()}`);
        if (!res.ok) {
            const body = await res.json().catch(() => null);
            throw new Error(body?.message || `Search failed (${res.status})`);
        }

        const total = parseInt(res.headers.get("X-Total-Count") || "0", 10);
        const data: { items: SearchRepoResult[]; total_count: number } = await res.json();

        return {
            total: total || data.total_count,
            items: data.items.map((r): RepoItem => ({
                id: r.id,
                owner: r.owner,
                name: r.name,
                description: r.description,
                isPrivate: !r.is_public,
                updatedAt: null,
            })),
        };
    }

    async function loadRepos(query: string, pageNum: number) {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const result = query.trim()
                ? await fetchSearchRepos(query.trim(), pageNum)
                : await fetchUserRepos(pageNum);
            setRepos(result.items);
            setTotalCount(result.total);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load repositories";
            setErrorMessage(message);
            setRepos([]);
            setTotalCount(0);
        } finally {
            setIsLoading(false);
        }
    }

    // When auth finishes loading, do the initial fetch.
    createEffect(
        on(authLoading, (loading) => {
            if (!loading && user()) {
                loadRepos("", 1);
            }
        })
    );

    // Debounced search: when searchQuery changes, wait 400ms then fetch.
    // { defer: true } skips the initial run so we don't double-fetch on mount.
    createEffect(
        on(searchQuery, (query) => {
            if (debounceTimer !== undefined) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                setPage(1);
                loadRepos(query, 1);
            }, 400);
        }, { defer: true })
    );

    function goToPage(newPage: number) {
        if (newPage < 1 || newPage > totalPages()) return;
        setPage(newPage);
        loadRepos(searchQuery(), newPage);
    }

    const { selectedIndex, setSelectedIndex, setItemRef, selectedItemIds, isSelected } = useListNavigation({
        items: repos,
        onOpen: (repo) => navigate(`/${repo.owner}/${repo.name}/code`),
        onCreate: () => navigate('/repo/new'),
        onFocusSearch: () => searchInputRef?.focus(),
        getItemId: (repo) => repo.id,
    });

    useSearchFocusTarget(() => searchInputRef?.focus());

    return (
        <div class="w-full bg-app text-primary">
            <div class="flex items-center justify-between px-6 py-4 border-b border-color">
                <div class="flex flex-col gap-0.5">
                    <h1 class="text-xl font-semibold flex items-center gap-2">
                        Repositories
                        <Show when={!isLoading()}>
                            <span class="badge-count subtle">{totalCount()}</span>
                        </Show>
                    </h1>
                    <Show when={user()}>
                        <p class="text-sm text-muted m-0">Welcome back, {user()!.display_name || user()!.username}</p>
                    </Show>
                </div>
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Find a repository..."
                            class="pl-9 pr-4 py-1.5 bg-panel border border-color rounded-md text-sm focus:border-blue transition-colors focus:outline-none"
                            value={searchQuery()}
                            onInput={(e) => {
                                setSearchQuery(e.currentTarget.value);
                                setSelectedIndex(0);
                            }}
                        />
                    </div>
                    <a href="/repo/new" class="btn btn-primary flex items-center gap-2" style={{ "text-decoration": "none" }}>
                        <Plus size={14} />
                        <span>New Repository</span>
                    </a>
                </div>
            </div>

            <div class="pt-4 pb-6 px-6 max-w-4xl mx-auto w-full">
                <Show when={deletedRepo()}>
                    <div class="mb-4 p-3 bg-green-900/20 border border-green-500/30 text-green-400 rounded-lg flex items-center justify-between text-sm animate-in">
                        <div class="flex items-center gap-2">
                            <CheckCircle2 size={16} />
                            <span>Deleted repository <strong>{deletedRepo()}</strong>.</span>
                        </div>
                        <button 
                            onClick={() => setDeletedRepo(null)}
                            class="text-green-400/60 hover:text-green-400 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </Show>

                <Show when={isLoading()}>
                    <div class="flex flex-col items-center justify-center h-48 text-muted">
                        <p>Loading repositories...</p>
                    </div>
                </Show>

                <Show when={errorMessage()}>
                    <div class="flex flex-col items-center justify-center h-48 text-red">
                        <p>{errorMessage()}</p>
                    </div>
                </Show>

                <Show when={!isLoading() && !errorMessage() && repos().length === 0}>
                    <div class="flex flex-col items-center justify-center h-48 text-muted">
                        <Book size={32} class="mb-4 opacity-50" />
                        <Show when={!searchQuery().trim()} fallback={<p>No repositories match your search.</p>}>
                            <p>You don't have any repositories yet.</p>
                            <a href="/repo/new" class="text-blue mt-2" style={{ "text-decoration": "none" }}>Create your first repository</a>
                        </Show>
                    </div>
                </Show>

                <Show when={!isLoading() && !errorMessage() && repos().length > 0}>
                    <div
                        class="border border-color rounded-lg overflow-hidden bg-root"
                        role="listbox"
                        tabindex={0}
                        aria-activedescendant={repos()[selectedIndex()] ? `repo-option-${repos()[selectedIndex()]!.id}` : undefined}
                    >
                        <For each={repos()}>
                            {(repo, index) => (
                                <a
                                    id={`repo-option-${repo.id}`}
                                    href={`/${repo.owner}/${repo.name}/code`}
                                    class={`flex items-start gap-3 p-4 border-b border-light transition-colors cursor-pointer ${selectedIndex() === index() ? 'bg-panel-hover' : 'hover:bg-panel-hover'} ${isSelected(repo, index()) ? 'keyboard-multi-selected' : ''}`}
                                    role="option"
                                    aria-selected={selectedIndex() === index()}
                                    style={{ "text-decoration": "none", color: "inherit" }}
                                    ref={(element) => setItemRef(index(), element)}
                                    onMouseEnter={() => setSelectedIndex(index())}
                                >
                                    <div class="mt-1 shrink-0">
                                        <Show when={repo.isPrivate} fallback={<Globe size={16} class="text-muted" />}>
                                            <Lock size={16} class="text-yellow" />
                                        </Show>
                                    </div>
                                    <div class="flex flex-col flex-1 min-w-0">
                                        <div class="flex items-baseline gap-2 mb-0.5">
                                            <span class="font-medium text-blue hover:underline">{repo.owner}/{repo.name}</span>
                                            <Show when={repo.isPrivate}>
                                                <span class="text-xs px-1.5 py-0.5 rounded border border-color text-muted relative" style={{ top: "-1px" }}>Private</span>
                                            </Show>
                                        </div>
                                        <Show when={repo.description}>
                                            <p class="text-sm text-muted m-0 mt-0.5 truncate">{repo.description}</p>
                                        </Show>
                                        <Show when={repo.updatedAt}>
                                            <div class="text-xs text-muted mt-1.5">
                                                Updated {formatRelativeTime(repo.updatedAt)}
                                            </div>
                                        </Show>
                                    </div>
                                    <ShortcutBadge shortcutId="list.open" class={`shortcut-hint ml-2 opacity-0 transition-opacity ${selectedIndex() === index() ? 'opacity-100' : ''}`} />
                                </a>
                            )}
                        </For>
                    </div>

                    <div class="mt-4 text-xs text-muted flex justify-center gap-4 flex-wrap">
                        <span>
                            <ShortcutBadge shortcutId="list.next" /> / <ShortcutBadge shortcutId="list.previous" /> navigate
                        </span>
                        <span>
                            <ShortcutBadge shortcutId="list.open" /> open
                        </span>
                        <span>
                            <ShortcutBadge shortcutId="list.select" /> select
                        </span>
                        <span>
                            <ShortcutBadge shortcutId="list.search" /> search
                        </span>
                        <Show when={selectedItemIds().length > 0}>
                            <span>{selectedItemIds().length} selected</span>
                        </Show>
                    </div>

                    {/* Pagination */}
                    <Show when={totalPages() > 1}>
                        <div class="flex items-center justify-between mt-4">
                            <button
                                class="btn btn-sm"
                                disabled={page() <= 1}
                                onClick={() => goToPage(page() - 1)}
                            >
                                Previous
                            </button>
                            <span class="text-sm text-muted">
                                Page {page()} of {totalPages()}
                            </span>
                            <button
                                class="btn btn-sm"
                                disabled={page() >= totalPages()}
                                onClick={() => goToPage(page() + 1)}
                            >
                                Next
                            </button>
                        </div>
                    </Show>
                </Show>
            </div>
        </div>
    );
}
