import { useNavigate, useParams } from "@solidjs/router";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { Boxes, Clock3, PackagePlus } from "lucide-solid";
import { createAuthenticatedEventSource } from "../../lib/authenticatedEventSource";
import { repoApiFetch, repoApiPath } from "../../lib/repoContext";
import "./Releases.css";

type ReleaseSummary = {
    id: number;
    tag_name: string;
    target_commitish: string;
    name: string;
    body: string;
    draft: boolean;
    prerelease: boolean;
    assets: Array<{ id: number }>;
    author: { id: number; login: string };
    created_at: string;
    updated_at: string;
    published_at?: string;
};

function getCookieValue(name: string): string | null {
    if (typeof document === "undefined") {
        return null;
    }

    const prefix = `${name}=`;
    for (const part of document.cookie.split(";").map((entry) => entry.trim())) {
        if (part.startsWith(prefix)) {
            return decodeURIComponent(part.slice(prefix.length));
        }
    }
    return null;
}

function buildWriteHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    const csrf = getCookieValue("__csrf");
    if (csrf) {
        headers["X-CSRF-Token"] = csrf;
    }
    return headers;
}

function formatRelativeTime(timestamp?: string): string {
    if (!timestamp) {
        return "unpublished";
    }
    const parsed = Date.parse(timestamp);
    if (Number.isNaN(parsed)) {
        return "recently";
    }

    const diffMinutes = Math.max(1, Math.floor((Date.now() - parsed) / 60000));
    if (diffMinutes < 60) {
        return `${diffMinutes}m ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
        return `${diffHours}h ago`;
    }

    return `${Math.floor(diffHours / 24)}d ago`;
}

export default function ReleasesList() {
    const navigate = useNavigate();
    const params = useParams<{ owner: string; repo: string }>();
    const context = () => ({ owner: params.owner ?? "", repo: params.repo ?? "" });

    const [releases, setReleases] = createSignal<ReleaseSummary[]>([]);
    const [isLoading, setIsLoading] = createSignal(true);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [isCreating, setIsCreating] = createSignal(false);
    const [tagName, setTagName] = createSignal("");
    const [targetCommitish, setTargetCommitish] = createSignal("");
    const [releaseName, setReleaseName] = createSignal("");
    const [releaseBody, setReleaseBody] = createSignal("");
    const [draft, setDraft] = createSignal(false);
    const [prerelease, setPrerelease] = createSignal(false);

    const loadReleases = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const response = await repoApiFetch("/releases?per_page=100", {}, context());
            if (!response.ok) {
                throw new Error(`Failed to load releases (${response.status})`);
            }
            const payload = (await response.json()) as ReleaseSummary[];
            setReleases(Array.isArray(payload) ? payload : []);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to load releases");
            setReleases([]);
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setTagName("");
        setTargetCommitish("");
        setReleaseName("");
        setReleaseBody("");
        setDraft(false);
        setPrerelease(false);
    };

    const createRelease = async () => {
        if (!tagName().trim()) {
            setErrorMessage("Tag name is required");
            return;
        }

        setIsCreating(true);
        setErrorMessage(null);
        try {
            const response = await repoApiFetch("/releases", {
                method: "POST",
                headers: buildWriteHeaders(),
                body: JSON.stringify({
                    tag_name: tagName().trim(),
                    target_commitish: targetCommitish().trim(),
                    name: releaseName().trim(),
                    body: releaseBody(),
                    draft: draft(),
                    prerelease: prerelease(),
                }),
            }, context());
            if (!response.ok) {
                throw new Error(`Failed to create release (${response.status})`);
            }

            const created = (await response.json()) as ReleaseSummary;
            resetForm();
            void loadReleases();
            navigate(`/${context().owner}/${context().repo}/releases/${created.id}`);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to create release");
        } finally {
            setIsCreating(false);
        }
    };

    onMount(() => {
        void loadReleases();

        const stream = createAuthenticatedEventSource(
            repoApiPath("/releases/events", context()),
            { withCredentials: true },
        );
        const reload = () => {
            void loadReleases();
        };
        stream.addEventListener("release", reload);
        stream.onerror = () => undefined;

        onCleanup(() => {
            stream.removeEventListener("release", reload);
            stream.close();
        });
    });

    return (
        <div class="flex h-full w-full overflow-y-auto bg-root text-primary">
            <div class="releases-view mx-auto flex w-full flex-col gap-6 p-8">
                <div class="flex flex-col gap-2">
                    <h1 class="flex items-center gap-3 text-3xl font-semibold">
                        <Boxes size={28} />
                        Releases
                    </h1>
                    <p class="text-sm text-muted">
                        Publish versioned snapshots, attach build artifacts, and monitor updates in real time.
                    </p>
                </div>

                <div class="release-panel p-5">
                    <div class="mb-4 flex items-center gap-3">
                        <PackagePlus size={18} class="text-blue" />
                        <h2 class="text-lg font-semibold">Create Release</h2>
                    </div>
                    <div class="release-form-grid">
                        <label class="flex flex-col gap-2 text-sm">
                            <span class="text-muted">Tag name</span>
                            <input
                                class="rounded-lg border border-color bg-app px-3 py-2"
                                value={tagName()}
                                onInput={(event) => setTagName(event.currentTarget.value)}
                                placeholder="v1.0.0"
                            />
                        </label>
                        <label class="flex flex-col gap-2 text-sm">
                            <span class="text-muted">Target commitish</span>
                            <input
                                class="rounded-lg border border-color bg-app px-3 py-2"
                                value={targetCommitish()}
                                onInput={(event) => setTargetCommitish(event.currentTarget.value)}
                                placeholder="main"
                            />
                        </label>
                        <label class="flex flex-col gap-2 text-sm">
                            <span class="text-muted">Title</span>
                            <input
                                class="rounded-lg border border-color bg-app px-3 py-2"
                                value={releaseName()}
                                onInput={(event) => setReleaseName(event.currentTarget.value)}
                                placeholder="Spring release"
                            />
                        </label>
                    </div>
                    <label class="mt-4 flex flex-col gap-2 text-sm">
                        <span class="text-muted">Release notes</span>
                        <textarea
                            class="min-h-32 rounded-lg border border-color bg-app px-3 py-2"
                            value={releaseBody()}
                            onInput={(event) => setReleaseBody(event.currentTarget.value)}
                            placeholder="Highlights, migration notes, and attached artifacts..."
                        />
                    </label>
                    <div class="mt-4 flex flex-wrap items-center gap-4 text-sm">
                        <label class="flex items-center gap-2">
                            <input type="checkbox" checked={draft()} onChange={(event) => setDraft(event.currentTarget.checked)} />
                            <span>Draft</span>
                        </label>
                        <label class="flex items-center gap-2">
                            <input type="checkbox" checked={prerelease()} onChange={(event) => setPrerelease(event.currentTarget.checked)} />
                            <span>Prerelease</span>
                        </label>
                        <button class="btn btn-primary" disabled={isCreating()} onClick={() => void createRelease()}>
                            {isCreating() ? "Creating..." : "Create release"}
                        </button>
                    </div>
                </div>

                <Show when={errorMessage()}>
                    <div class="release-panel border-red/30 p-4 text-sm text-red">
                        {errorMessage()}
                    </div>
                </Show>

                <div class="flex items-center justify-between">
                    <h2 class="text-xl font-semibold">Recent Releases</h2>
                    <span class="text-sm text-muted">{releases().length} total</span>
                </div>

                <Show when={isLoading()}>
                    <div class="release-panel p-6 text-sm text-muted">Loading releases...</div>
                </Show>

                <Show when={!isLoading() && releases().length === 0}>
                    <div class="release-panel p-6 text-sm text-muted">
                        No releases yet. Create the first release for this repository.
                    </div>
                </Show>

                <div class="grid gap-4">
                    <For each={releases()}>
                        {(release) => (
                            <button
                                type="button"
                                class="release-card flex w-full flex-col gap-4 p-5 text-left"
                                onClick={() => navigate(`/${context().owner}/${context().repo}/releases/${release.id}`)}
                            >
                                <div class="flex flex-wrap items-start justify-between gap-3">
                                    <div class="flex min-w-0 flex-col gap-2">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <span class="font-mono text-sm text-blue">{release.tag_name}</span>
                                            <Show when={release.name}>
                                                <span class="text-lg font-semibold text-primary">{release.name}</span>
                                            </Show>
                                            <Show when={release.draft}>
                                                <span class="release-badge is-draft">Draft</span>
                                            </Show>
                                            <Show when={release.prerelease}>
                                                <span class="release-badge is-prerelease">Prerelease</span>
                                            </Show>
                                        </div>
                                        <p class="line-clamp-2 text-sm text-secondary">
                                            {release.body || "No release notes provided."}
                                        </p>
                                    </div>
                                    <div class="flex items-center gap-2 text-xs text-muted">
                                        <Clock3 size={14} />
                                        <span>{formatRelativeTime(release.published_at ?? release.created_at)}</span>
                                    </div>
                                </div>
                                <div class="flex flex-wrap items-center gap-4 text-sm text-muted">
                                    <span>Target: {release.target_commitish || "default"}</span>
                                    <span>Publisher: {release.author.login}</span>
                                    <span>{release.assets.length} assets</span>
                                </div>
                            </button>
                        )}
                    </For>
                </div>
            </div>
        </div>
    );
}
