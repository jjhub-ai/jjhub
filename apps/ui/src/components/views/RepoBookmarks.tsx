import { useNavigate, useParams } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { BookMarked, FileCode, GitCommit, GitPullRequest, Search } from "lucide-solid";
import {
    repoBookmarksResource,
    type BookmarkResponse,
} from "../../lib/navigationData";
import "./RepoBookmarks.css";

type BookmarkFilter = "active" | "remote" | "all";

export default function RepoBookmarks() {
    const params = useParams<{ owner: string; repo: string }>();
    const navigate = useNavigate();
    const repoContext = () => ({
        owner: params.owner ?? "",
        repo: params.repo ?? "",
    });
    const initialBundle = repoBookmarksResource.peek(repoContext());
    const [bookmarks, setBookmarks] = createSignal<BookmarkResponse[]>(initialBundle?.bookmarks ?? []);
    const [defaultBookmark, setDefaultBookmark] = createSignal<string>(initialBundle?.repo.default_bookmark ?? "");
    const [filter, setFilter] = createSignal<BookmarkFilter>("active");
    const [searchQuery, setSearchQuery] = createSignal("");
    const [isLoading, setIsLoading] = createSignal(initialBundle === undefined);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

    const filteredBookmarks = createMemo(() => {
        let rows = bookmarks();
        if (filter() !== "all") {
            rows = rows.filter((bookmark) => {
                return filter() === "active" ? !bookmark.is_tracking_remote : bookmark.is_tracking_remote;
            });
        }

        const q = searchQuery().trim().toLowerCase();
        if (!q) {
            return rows;
        }
        return rows.filter((bookmark) => {
            return (
                bookmark.name.toLowerCase().includes(q) ||
                bookmark.target_change_id.toLowerCase().includes(q) ||
                bookmark.target_commit_id.toLowerCase().includes(q)
            );
        });
    });

    createEffect(() => {
        const context = repoContext();
        if (!context.owner || !context.repo) {
            return;
        }

        void (async () => {
            const cachedBundle = repoBookmarksResource.peek(context);
            if (cachedBundle) {
                setDefaultBookmark(cachedBundle.repo.default_bookmark || "");
                setBookmarks(cachedBundle.bookmarks);
            }

            setIsLoading(!cachedBundle);
            setErrorMessage(null);
            try {
                const bundle = await repoBookmarksResource.load(context);
                setDefaultBookmark(bundle.repo.default_bookmark || "");
                setBookmarks(bundle.bookmarks);
            } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to load bookmarks";
                setErrorMessage(message);
                setBookmarks([]);
            } finally {
                setIsLoading(false);
            }
        })();
    });

    const navigateToBookmark = (bookmarkName: string) => {
        const context = repoContext();
        navigate(`/${context.owner}/${context.repo}/bookmarks/${encodeURIComponent(bookmarkName)}`);
    };

    const navigateToBookmarkCode = (bookmarkName: string) => {
        const context = repoContext();
        navigate(`/${context.owner}/${context.repo}/code?ref=${encodeURIComponent(bookmarkName)}`);
    };

    return (
        <div class="bookmarks-container">
            <header class="bookmarks-header animate-in stagger-1">
                <div class="header-title">
                    <BookMarked size={20} class="text-primary" />
                    <h1>Bookmarks</h1>
                </div>
                <div class="header-actions">
                    <div class="search-box">
                        <Search size={14} class="text-muted" />
                        <input
                            type="text"
                            placeholder="Search bookmarks..."
                            value={searchQuery()}
                            onInput={(event) => setSearchQuery(event.currentTarget.value)}
                        />
                    </div>
                    <button class="primary-btn">New Bookmark</button>
                </div>
            </header>

            <div class="bookmarks-toolbar animate-in stagger-2">
                <div class="toolbar-tabs">
                    <button class="tab" classList={{ active: filter() === "active" }} onClick={() => setFilter("active")}>
                        Active
                    </button>
                    <button class="tab" classList={{ active: filter() === "remote" }} onClick={() => setFilter("remote")}>
                        Remote
                    </button>
                    <button class="tab" classList={{ active: filter() === "all" }} onClick={() => setFilter("all")}>
                        All
                    </button>
                </div>
            </div>

            <div class="bookmarks-list animate-in stagger-3">
                <div class="list-header">
                    <div class="col-name">Name</div>
                    <div class="col-commit">Top Commit</div>
                    <div class="col-status">Status</div>
                </div>

                <Show when={isLoading()}>
                    <div class="bookmark-row">
                        <div class="col-name text-muted">Loading bookmarks...</div>
                    </div>
                </Show>
                <Show when={errorMessage()}>
                    {(message) => (
                        <div class="bookmark-row">
                            <div class="col-name text-red">{message()}</div>
                        </div>
                    )}
                </Show>

                <For each={filteredBookmarks()}>
                    {(bookmark) => {
                        const isDefault = bookmark.name === defaultBookmark();
                        return (
                            <div
                                class="bookmark-row bookmark-row-clickable"
                                onClick={() => navigateToBookmark(bookmark.name)}
                            >
                                <div class="col-name">
                                    <div class="bm-name-wrapper">
                                        <GitPullRequest size={16} class={isDefault ? "text-blue" : "text-muted"} />
                                        <span class="bm-name" classList={{ "font-semibold": isDefault }}>
                                            {bookmark.name}
                                        </span>
                                        <Show when={isDefault}>
                                            <span class="badge blue">Default</span>
                                        </Show>
                                    </div>
                                    <div class="bm-meta">
                                        <span class="bm-time">
                                            {bookmark.is_tracking_remote ? "Tracking remote" : "Local bookmark"}
                                        </span>
                                    </div>
                                </div>

                                <div class="col-commit">
                                    <div class="commit-desc">{bookmark.target_change_id}</div>
                                    <div class="commit-hash">
                                        <GitCommit size={12} />
                                        <span>{bookmark.target_commit_id}</span>
                                    </div>
                                </div>

                                <div class="col-status">
                                    <div class="status-bar">
                                        <span class={bookmark.is_tracking_remote ? "text-cyan" : "text-muted"}>
                                            {bookmark.is_tracking_remote ? "Remote tracked" : "Standalone"}
                                        </span>
                                    </div>
                                    <div class="row-actions">
                                        <button
                                            aria-label="View Code"
                                            class="action-btn"
                                            title="View Code"
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                navigateToBookmarkCode(bookmark.name);
                                            }}
                                        >
                                            <FileCode size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    }}
                </For>
            </div>
        </div>
    );
}
