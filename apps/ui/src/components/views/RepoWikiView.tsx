import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { BookOpen, Edit2, Plus, Save, Search, Trash2 } from "lucide-solid";
import MarkdownIt from "markdown-it";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { withAuthHeaders } from "../../lib/repoContext";
import "./FeatureSurface.css";
import { formatDateTime, readErrorMessage } from "./viewSupport";

type WikiMode = "index" | "create" | "view" | "edit";

type WikiAuthor = {
    id: number;
    login: string;
};

type WikiPage = {
    id: number;
    slug: string;
    title: string;
    body?: string;
    author: WikiAuthor;
    created_at: string;
    updated_at: string;
};

const markdown = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: false,
});

function modeFromPath(pathname: string, slug?: string): WikiMode {
    if (pathname.endsWith("/wiki/new")) {
        return "create";
    }
    if (pathname.endsWith("/edit")) {
        return "edit";
    }
    if (slug) {
        return "view";
    }
    return "index";
}

function slugify(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/--+/g, "-");
}

export default function RepoWikiView() {
    const params = useParams<{ owner: string; repo: string; slug?: string }>();
    const location = useLocation();
    const navigate = useNavigate();

    const owner = () => params.owner ?? "";
    const repo = () => params.repo ?? "";
    const slug = () => params.slug ?? "";
    const basePath = () => `/${owner()}/${repo()}/wiki`;
    const apiBase = () => `/api/repos/${owner()}/${repo()}/wiki`;
    const mode = createMemo<WikiMode>(() => modeFromPath(location.pathname, params.slug));

    const [pages, setPages] = createSignal<WikiPage[]>([]);
    const [currentPage, setCurrentPage] = createSignal<WikiPage | null>(null);
    const [isLoading, setIsLoading] = createSignal(true);
    const [isSaving, setIsSaving] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [notice, setNotice] = createSignal<string | null>(null);
    const [searchQuery, setSearchQuery] = createSignal("");
    const [draftTitle, setDraftTitle] = createSignal("");
    const [draftSlug, setDraftSlug] = createSignal("");
    const [draftBody, setDraftBody] = createSignal("");
    const [slugDirty, setSlugDirty] = createSignal(false);

    const loadRoute = async () => {
        if (!owner() || !repo()) {
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);
        try {
            const query = new URLSearchParams({ limit: "100" });
            if (searchQuery().trim()) {
                query.set("q", searchQuery().trim());
            }

            const pagesResponse = await fetch(`${apiBase()}?${query.toString()}`, {
                credentials: "include",
                headers: withAuthHeaders(),
            });
            if (!pagesResponse.ok) {
                throw new Error(await readErrorMessage(pagesResponse, "Failed to load wiki pages"));
            }
            const pageList = (await pagesResponse.json()) as WikiPage[];
            setPages(Array.isArray(pageList) ? pageList : []);

            if (mode() === "view" || mode() === "edit") {
                const pageResponse = await fetch(`${apiBase()}/${encodeURIComponent(slug())}`, {
                    credentials: "include",
                    headers: withAuthHeaders(),
                });
                if (!pageResponse.ok) {
                    throw new Error(await readErrorMessage(pageResponse, "Failed to load wiki page"));
                }

                const page = (await pageResponse.json()) as WikiPage;
                setCurrentPage(page);
                setDraftTitle(page.title);
                setDraftSlug(page.slug);
                setDraftBody(page.body ?? "");
                setSlugDirty(true);
            } else {
                setCurrentPage(null);
                if (mode() === "create") {
                    setDraftTitle("");
                    setDraftSlug("");
                    setDraftBody("");
                    setSlugDirty(false);
                }
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to load repository wiki");
        } finally {
            setIsLoading(false);
        }
    };

    createEffect(() => {
        void location.pathname;
        void params.slug;
        void searchQuery();
        void loadRoute();
    });

    const handleTitleInput = (value: string) => {
        setDraftTitle(value);
        if (mode() === "create" && !slugDirty()) {
            setDraftSlug(slugify(value));
        }
    };

    const createPage = async (event: Event) => {
        event.preventDefault();
        if (!draftTitle().trim()) {
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);
        setNotice(null);
        try {
            const response = await fetch(apiBase(), {
                method: "POST",
                credentials: "include",
                headers: withAuthHeaders({
                    "Content-Type": "application/json",
                }),
                body: JSON.stringify({
                    title: draftTitle().trim(),
                    slug: draftSlug().trim() || undefined,
                    body: draftBody(),
                }),
            });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, "Failed to create wiki page"));
            }
            const created = (await response.json()) as WikiPage;
            setNotice(`Created wiki page ${created.title}.`);
            navigate(`${basePath()}/${encodeURIComponent(created.slug)}`);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to create wiki page");
        } finally {
            setIsSaving(false);
        }
    };

    const updatePage = async (event: Event) => {
        event.preventDefault();
        const page = currentPage();
        if (!page) {
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);
        setNotice(null);
        try {
            const response = await fetch(`${apiBase()}/${encodeURIComponent(page.slug)}`, {
                method: "PATCH",
                credentials: "include",
                headers: withAuthHeaders({
                    "Content-Type": "application/json",
                }),
                body: JSON.stringify({
                    title: draftTitle().trim(),
                    slug: draftSlug().trim() || page.slug,
                    body: draftBody(),
                }),
            });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, "Failed to update wiki page"));
            }
            const updated = (await response.json()) as WikiPage;
            setNotice(`Updated ${updated.title}.`);
            navigate(`${basePath()}/${encodeURIComponent(updated.slug)}`);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to update wiki page");
        } finally {
            setIsSaving(false);
        }
    };

    const deletePage = async () => {
        const page = currentPage();
        if (!page || !confirm(`Delete wiki page ${page.title}?`)) {
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);
        setNotice(null);
        try {
            const response = await fetch(`${apiBase()}/${encodeURIComponent(page.slug)}`, {
                method: "DELETE",
                credentials: "include",
                headers: withAuthHeaders(),
            });
            if (!response.ok && response.status !== 204) {
                throw new Error(await readErrorMessage(response, "Failed to delete wiki page"));
            }
            setNotice(`Deleted ${page.title}.`);
            navigate(basePath());
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to delete wiki page");
        } finally {
            setIsSaving(false);
        }
    };

    const renderPageSidebar = () => (
        <nav class="surface-nav">
            <a href={basePath()} class={`surface-nav-link ${mode() === "index" ? "active" : ""}`}>
                <BookOpen size={16} />
                Wiki Home
            </a>
            <a href={`${basePath()}/new`} class={`surface-nav-link ${mode() === "create" ? "active" : ""}`}>
                <Plus size={16} />
                New Page
            </a>
            <div class="surface-field">
                <label for="wiki-search">Search pages</label>
                <div style={{ position: "relative" }}>
                    <Search size={14} class="text-muted" style={{ position: "absolute", top: "12px", left: "12px" }} />
                    <input
                        id="wiki-search"
                        type="search"
                        value={searchQuery()}
                        onInput={(event) => setSearchQuery(event.currentTarget.value)}
                        placeholder="Search titles, slugs, or content"
                        style={{ "padding-left": "36px" }}
                    />
                </div>
            </div>
            <For each={pages()}>
                {(page) => (
                    <a
                        href={`${basePath()}/${encodeURIComponent(page.slug)}`}
                        class={`surface-nav-link ${currentPage()?.slug === page.slug ? "active" : ""}`}
                    >
                        <BookOpen size={16} />
                        {page.title}
                    </a>
                )}
            </For>
        </nav>
    );

    const renderIndex = () => (
        <div class="surface-card">
            <div class="surface-card-header">
                <div>
                    <h2>Repository Wiki</h2>
                    <p>Browse markdown documentation for {owner()}/{repo()} or create the first page.</p>
                </div>
                <BookOpen size={20} class="text-muted" />
            </div>
            <Show when={pages().length > 0} fallback={
                <div class="surface-empty">
                    <h3>No wiki pages yet</h3>
                    <p>Start the repository wiki with architecture notes, runbooks, or contributor docs.</p>
                </div>
            }>
                <div class="surface-list">
                    <For each={pages()}>
                        {(page) => (
                            <a href={`${basePath()}/${encodeURIComponent(page.slug)}`} class="surface-row" style={{ "text-decoration": "none" }}>
                                <div class="surface-row-main">
                                    <div class="surface-row-title">
                                        <h3>{page.title}</h3>
                                        <span class="surface-code">{page.slug}</span>
                                    </div>
                                    <div class="surface-meta">
                                        <span>Updated {formatDateTime(page.updated_at)}</span>
                                        <span>by {page.author.login}</span>
                                    </div>
                                </div>
                            </a>
                        )}
                    </For>
                </div>
            </Show>
        </div>
    );

    const renderEditor = () => (
        <form class="surface-card surface-form" onSubmit={(event) => void (mode() === "create" ? createPage(event) : updatePage(event))}>
            <div class="surface-card-header">
                <div>
                    <h2>{mode() === "create" ? "Create wiki page" : `Edit ${currentPage()?.title}`}</h2>
                    <p>Wiki pages are stored directly in JJHub with markdown content and repository-scoped slugs.</p>
                </div>
                <Edit2 size={20} class="text-muted" />
            </div>

            <div class="surface-field">
                <label for="wiki-page-title">Title</label>
                <input
                    id="wiki-page-title"
                    type="text"
                    value={draftTitle()}
                    onInput={(event) => handleTitleInput(event.currentTarget.value)}
                    placeholder="Architecture"
                    autofocus={mode() === "create"}
                    required
                />
            </div>

            <div class="surface-field">
                <label for="wiki-page-slug">Slug</label>
                <input
                    id="wiki-page-slug"
                    type="text"
                    value={draftSlug()}
                    onInput={(event) => {
                        setSlugDirty(true);
                        setDraftSlug(slugify(event.currentTarget.value));
                    }}
                    placeholder="architecture"
                />
                <p class="text-muted">Used in the page URL. Leave blank on create to derive it from the title.</p>
            </div>

            <div class="surface-field">
                <label for="wiki-page-body">Markdown content</label>
                <textarea
                    id="wiki-page-body"
                    value={draftBody()}
                    onInput={(event) => setDraftBody(event.currentTarget.value)}
                    placeholder="# Runbook"
                />
            </div>

            <div class="surface-form-actions">
                <Show when={mode() === "edit"}>
                    <button type="button" class="secondary-btn" onClick={() => navigate(`${basePath()}/${encodeURIComponent(currentPage()!.slug)}`)} disabled={isSaving()}>
                        Cancel
                    </button>
                </Show>
                <button type="submit" class="primary-btn" disabled={isSaving() || !draftTitle().trim()}>
                    <Save size={16} />
                    {isSaving() ? "Saving..." : mode() === "create" ? "Create Page" : "Save Changes"}
                </button>
            </div>
        </form>
    );

    const renderPageView = () => (
        <div class="surface-card">
            <div class="surface-card-header">
                <div>
                    <h2>{currentPage()?.title}</h2>
                    <p>
                        /{currentPage()?.slug} updated {formatDateTime(currentPage()?.updated_at)} by {currentPage()?.author.login}
                    </p>
                </div>
                <div class="surface-actions">
                    <a class="secondary-btn" href={`${basePath()}/${encodeURIComponent(currentPage()!.slug)}/edit`}>
                        <Edit2 size={14} />
                        Edit
                    </a>
                    <button class="danger-btn" disabled={isSaving()} onClick={() => void deletePage()} title="Delete page">
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
            <Show when={currentPage()?.body?.trim()} fallback={
                <div class="surface-empty">
                    <h3>This page is empty</h3>
                    <p>Edit the page to add markdown content.</p>
                </div>
            }>
                <div class="surface-markdown" innerHTML={markdown.render(currentPage()?.body ?? "")} />
            </Show>
        </div>
    );

    return (
        <div class="surface-page">
            <header class="surface-header">
                <div>
                    <h1>Repository Wiki</h1>
                    <p>Write and review markdown documentation for {owner()}/{repo()}.</p>
                </div>
            </header>

            <Show when={errorMessage()}>
                {(message) => <div class="surface-banner error">{message()}</div>}
            </Show>
            <Show when={notice()}>
                {(message) => <div class="surface-banner success">{message()}</div>}
            </Show>

            <div class="surface-shell">
                {renderPageSidebar()}

                <div class="surface-stack">
                    <Show when={isLoading()}>
                        <div class="surface-empty">
                            <h3>Loading wiki...</h3>
                        </div>
                    </Show>

                    <Show when={!isLoading()}>
                        {mode() === "index" && renderIndex()}
                        {(mode() === "create" || mode() === "edit") && renderEditor()}
                        {mode() === "view" && currentPage() && renderPageView()}
                    </Show>
                </div>
            </div>
        </div>
    );
}
