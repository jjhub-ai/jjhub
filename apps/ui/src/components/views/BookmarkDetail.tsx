import { createMemo, createSignal, Show } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import { ArrowLeft, BookMarked, FileCode, GitCommit, GitPullRequest } from "lucide-solid";
import { repoApiFetch } from "../../lib/repoContext";
import "./BookmarkDetail.css";

type BookmarkResponse = {
    name: string;
    target_change_id: string;
    target_commit_id: string;
    is_tracking_remote: boolean;
    remote_name?: string;
};

type RepoResponse = {
    default_bookmark: string;
};

function decodeBookmarkName(name: string | undefined): string {
    if (!name) {
        return "";
    }
    try {
        return decodeURIComponent(name);
    } catch {
        return name;
    }
}

export default function BookmarkDetail() {
    const params = useParams<{ owner: string; repo: string; name: string }>();
    const navigate = useNavigate();
    const bookmarkName = createMemo(() => decodeBookmarkName(params.name));

    const repoContext = () => ({
        owner: params.owner ?? "",
        repo: params.repo ?? "",
    });

    const [bookmark, setBookmark] = createSignal<BookmarkResponse | null>(null);
    const [defaultBookmark, setDefaultBookmark] = createSignal("");
    const [isLoading, setIsLoading] = createSignal(true);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

    const loadBookmark = async () => {
        const context = repoContext();
        if (!context.owner || !context.repo) {
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);
        setBookmark(null);

        try {
            const [repoResponse, bookmarksResponse] = await Promise.all([
                repoApiFetch("", {}, context),
                repoApiFetch("/bookmarks?per_page=100", {}, context),
            ]);

            if (!repoResponse.ok || !bookmarksResponse.ok) {
                throw new Error("Failed to load bookmark");
            }

            const repo = (await repoResponse.json()) as RepoResponse;
            const rows = await bookmarksResponse.json();
            const items = Array.isArray(rows) ? rows : (rows.items ?? []);
            const currentBookmark = (items as BookmarkResponse[]).find((item) => item.name === bookmarkName());

            if (!currentBookmark) {
                throw new Error("Bookmark not found");
            }

            setDefaultBookmark(repo.default_bookmark || "");
            setBookmark(currentBookmark);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load bookmark";
            setErrorMessage(message);
        } finally {
            setIsLoading(false);
        }
    };

    // Use createEffect-like pattern: load on mount
    void loadBookmark();

    const isDefault = createMemo(() => {
        const current = bookmark();
        return current?.name === defaultBookmark();
    });

    const remoteName = createMemo(() => {
        const current = bookmark();
        if (!current) {
            return "None";
        }
        const explicitRemoteName = current.remote_name?.trim();
        if (explicitRemoteName) {
            return explicitRemoteName;
        }
        return current.is_tracking_remote ? "Unknown" : "None";
    });

    const bookmarksHref = createMemo(() => {
        const context = repoContext();
        return `/${context.owner}/${context.repo}/bookmarks`;
    });

    const codeHref = createMemo(() => {
        const context = repoContext();
        const current = bookmark();
        if (!current) {
            return `/${context.owner}/${context.repo}/code`;
        }
        return `/${context.owner}/${context.repo}/code?ref=${encodeURIComponent(current.name)}`;
    });

    return (
        <div class="bookmark-detail-container">
            <a
                class="bookmark-back-link animate-in stagger-1"
                href={bookmarksHref()}
                onClick={(event) => {
                    event.preventDefault();
                    navigate(bookmarksHref());
                }}
            >
                <ArrowLeft size={16} />
                <span>Back to Bookmarks</span>
            </a>

            <Show when={isLoading()}>
                <p class="text-muted">Loading bookmark...</p>
            </Show>

            <Show when={errorMessage()}>
                {(message) => <p class="text-red">{message()}</p>}
            </Show>

            <Show when={bookmark()}>
                {(currentBookmark) => (
                    <>
                        <header class="bookmark-detail-header animate-in stagger-2">
                            <div class="bookmark-detail-heading">
                                <div class="bookmark-detail-title-row">
                                    <BookMarked size={22} class="text-primary" />
                                    <h1>{currentBookmark().name}</h1>
                                    <Show when={isDefault()}>
                                        <span class="badge blue">Default</span>
                                    </Show>
                                </div>
                                <p class="bookmark-detail-subtitle">
                                    {isDefault() ? "Default bookmark" : "Non-default bookmark"} for{" "}
                                    <span class="bookmark-detail-inline-code">{repoContext().owner}/{repoContext().repo}</span>
                                </p>
                            </div>

                            <a
                                class="bookmark-code-link"
                                href={codeHref()}
                                onClick={(event) => {
                                    event.preventDefault();
                                    navigate(codeHref());
                                }}
                            >
                                <FileCode size={16} />
                                <span>View Code at This Bookmark</span>
                            </a>
                        </header>

                        <div class="bookmark-detail-grid animate-in stagger-3">
                            <section class="bookmark-detail-card">
                                <span class="bookmark-detail-label">Bookmark</span>
                                <div class="bookmark-detail-value-row">
                                    <BookMarked size={18} class="text-primary" />
                                    <span class="bookmark-detail-inline-code">{currentBookmark().name}</span>
                                </div>
                                <p class="bookmark-detail-muted">
                                    {isDefault()
                                        ? "This bookmark is the repository default."
                                        : "This bookmark is not the repository default."}
                                </p>
                            </section>

                            <section class="bookmark-detail-card">
                                <span class="bookmark-detail-label">Remote Tracking</span>
                                <div class="bookmark-detail-value-row">
                                    <GitPullRequest
                                        size={18}
                                        class={currentBookmark().is_tracking_remote ? "text-blue" : "text-muted"}
                                    />
                                    <span>{currentBookmark().is_tracking_remote ? "Tracking remote" : "Local bookmark"}</span>
                                </div>
                                <p class="bookmark-detail-muted">
                                    Remote name: <span class="bookmark-detail-inline-code">{remoteName()}</span>
                                </p>
                            </section>

                            <section class="bookmark-detail-card">
                                <span class="bookmark-detail-label">Target Change</span>
                                <div class="bookmark-detail-value-row">
                                    <GitCommit size={18} class="text-primary" />
                                    <span class="bookmark-detail-inline-code">{currentBookmark().target_change_id}</span>
                                </div>
                                <p class="bookmark-detail-muted">
                                    Commit ID:{" "}
                                    <span class="bookmark-detail-inline-code">{currentBookmark().target_commit_id}</span>
                                </p>
                            </section>
                        </div>
                    </>
                )}
            </Show>
        </div>
    );
}
