import { useNavigate, useParams } from "@solidjs/router";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { ArrowLeft, Download, Trash2, Upload } from "lucide-solid";
import { createAuthenticatedEventSource } from "../../lib/authenticatedEventSource";
import { repoApiFetch, repoApiPath } from "../../lib/repoContext";
import "./Releases.css";

type ReleaseAsset = {
    id: number;
    name: string;
    size: number;
    content_type: string;
    status: string;
    download_count: number;
    confirmed_at?: string;
    created_at: string;
    updated_at: string;
};

type ReleaseDetailResponse = {
    id: number;
    tag_name: string;
    target_commitish: string;
    name: string;
    body: string;
    draft: boolean;
    prerelease: boolean;
    author: { id: number; login: string };
    assets: ReleaseAsset[];
    created_at: string;
    updated_at: string;
    published_at?: string;
};

type ReleaseAssetUploadResponse = {
    asset: ReleaseAsset;
    upload_url: string;
};

type ReleaseAssetDownloadResponse = {
    asset: ReleaseAsset;
    download_url: string;
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

function formatFileSize(size: number): string {
    if (size < 1024) {
        return `${size} B`;
    }
    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }
    if (size < 1024 * 1024 * 1024) {
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function inferContentType(file: File): string {
    return file.type || "application/octet-stream";
}

export default function ReleaseDetail() {
    const navigate = useNavigate();
    const params = useParams<{ owner: string; repo: string; id: string }>();
    const context = () => ({ owner: params.owner ?? "", repo: params.repo ?? "" });
    const releaseID = () => params.id ?? "";

    const [release, setRelease] = createSignal<ReleaseDetailResponse | null>(null);
    const [isLoading, setIsLoading] = createSignal(true);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [uploadFile, setUploadFile] = createSignal<File | null>(null);
    const [uploadName, setUploadName] = createSignal("");
    const [isUploading, setIsUploading] = createSignal(false);
    const [isDeleting, setIsDeleting] = createSignal(false);

    const loadRelease = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const response = await repoApiFetch(`/releases/${releaseID()}`, {}, context());
            if (!response.ok) {
                throw new Error(`Failed to load release (${response.status})`);
            }
            const payload = (await response.json()) as ReleaseDetailResponse;
            setRelease(payload);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to load release");
            setRelease(null);
        } finally {
            setIsLoading(false);
        }
    };

    const uploadAsset = async () => {
        const file = uploadFile();
        const currentRelease = release();
        if (!file || !currentRelease) {
            return;
        }

        setIsUploading(true);
        setErrorMessage(null);
        try {
            const uploadResponse = await repoApiFetch(`/releases/${currentRelease.id}/assets`, {
                method: "POST",
                headers: buildWriteHeaders(),
                body: JSON.stringify({
                    name: uploadName().trim() || file.name,
                    size: file.size,
                    content_type: inferContentType(file),
                }),
            }, context());
            if (!uploadResponse.ok) {
                throw new Error(`Failed to create upload (${uploadResponse.status})`);
            }

            const upload = (await uploadResponse.json()) as ReleaseAssetUploadResponse;
            const storageResponse = await fetch(upload.upload_url, {
                method: "PUT",
                headers: {
                    "Content-Type": inferContentType(file),
                },
                body: file,
            });
            if (!storageResponse.ok) {
                throw new Error(`Asset upload failed (${storageResponse.status})`);
            }

            const confirmResponse = await repoApiFetch(`/releases/${currentRelease.id}/assets/${upload.asset.id}/confirm`, {
                method: "POST",
                headers: buildWriteHeaders(),
            }, context());
            if (!confirmResponse.ok) {
                throw new Error(`Failed to confirm asset (${confirmResponse.status})`);
            }

            setUploadFile(null);
            setUploadName("");
            void loadRelease();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to upload asset");
        } finally {
            setIsUploading(false);
        }
    };

    const downloadAsset = async (assetID: number) => {
        const currentRelease = release();
        if (!currentRelease) {
            return;
        }

        setErrorMessage(null);
        try {
            const response = await repoApiFetch(`/releases/${currentRelease.id}/assets/${assetID}/download`, {}, context());
            if (!response.ok) {
                throw new Error(`Failed to fetch download URL (${response.status})`);
            }
            const payload = (await response.json()) as ReleaseAssetDownloadResponse;
            window.location.assign(payload.download_url);
            void loadRelease();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to download asset");
        }
    };

    const deleteAsset = async (assetID: number) => {
        const currentRelease = release();
        if (!currentRelease || !window.confirm("Delete this release asset?")) {
            return;
        }

        setErrorMessage(null);
        try {
            const response = await repoApiFetch(`/releases/${currentRelease.id}/assets/${assetID}`, {
                method: "DELETE",
                headers: buildWriteHeaders(),
            }, context());
            if (!response.ok) {
                throw new Error(`Failed to delete asset (${response.status})`);
            }
            void loadRelease();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to delete asset");
        }
    };

    const deleteRelease = async () => {
        const currentRelease = release();
        if (!currentRelease || !window.confirm(`Delete release ${currentRelease.tag_name}?`)) {
            return;
        }

        setIsDeleting(true);
        setErrorMessage(null);
        try {
            const response = await repoApiFetch(`/releases/${currentRelease.id}`, {
                method: "DELETE",
                headers: buildWriteHeaders(),
            }, context());
            if (!response.ok) {
                throw new Error(`Failed to delete release (${response.status})`);
            }
            navigate(`/${context().owner}/${context().repo}/releases`);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to delete release");
        } finally {
            setIsDeleting(false);
        }
    };

    onMount(() => {
        void loadRelease();

        const stream = createAuthenticatedEventSource(
            repoApiPath("/releases/events", context()),
            { withCredentials: true },
        );
        const reload = () => {
            void loadRelease();
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
                <div class="flex items-center justify-between gap-4">
                    <button class="btn" onClick={() => navigate(`/${context().owner}/${context().repo}/releases`)}>
                        <span class="flex items-center gap-2">
                            <ArrowLeft size={14} />
                            Back to releases
                        </span>
                    </button>
                    <button class="btn border border-red/20 text-red" disabled={isDeleting()} onClick={() => void deleteRelease()}>
                        <span class="flex items-center gap-2">
                            <Trash2 size={14} />
                            {isDeleting() ? "Deleting..." : "Delete release"}
                        </span>
                    </button>
                </div>

                <Show when={isLoading()}>
                    <div class="release-panel p-6 text-sm text-muted">Loading release...</div>
                </Show>

                <Show when={errorMessage()}>
                    <div class="release-panel border-red/30 p-4 text-sm text-red">{errorMessage()}</div>
                </Show>

                <Show when={release()}>
                    {(currentRelease) => (
                        <>
                            <div class="release-panel p-6">
                                <div class="flex flex-wrap items-start justify-between gap-4">
                                    <div class="flex min-w-0 flex-col gap-3">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <span class="font-mono text-sm text-blue">{currentRelease().tag_name}</span>
                                            <Show when={currentRelease().name}>
                                                <h1 class="text-3xl font-semibold">{currentRelease().name}</h1>
                                            </Show>
                                            <Show when={currentRelease().draft}>
                                                <span class="release-badge is-draft">Draft</span>
                                            </Show>
                                            <Show when={currentRelease().prerelease}>
                                                <span class="release-badge is-prerelease">Prerelease</span>
                                            </Show>
                                        </div>
                                        <div class="flex flex-wrap items-center gap-4 text-sm text-muted">
                                            <span>Target: {currentRelease().target_commitish || "default"}</span>
                                            <span>Publisher: {currentRelease().author.login}</span>
                                            <Show when={currentRelease().published_at}>
                                                <span>Published: {new Date(currentRelease().published_at!).toLocaleString()}</span>
                                            </Show>
                                        </div>
                                    </div>
                                </div>
                                <div class="release-body mt-6 text-sm text-secondary">
                                    {currentRelease().body || "No release notes provided."}
                                </div>
                            </div>

                            <div class="release-panel p-6">
                                <div class="mb-4 flex items-center justify-between gap-4">
                                    <div>
                                        <h2 class="text-xl font-semibold">Assets</h2>
                                        <p class="text-sm text-muted">
                                            Upload binary artifacts, archives, and release notes bundles.
                                        </p>
                                    </div>
                                </div>

                                <div class="mb-5 flex flex-wrap items-end gap-3">
                                    <label class="flex min-w-60 flex-1 flex-col gap-2 text-sm">
                                        <span class="text-muted">Asset file</span>
                                        <input
                                            type="file"
                                            onChange={(event) => {
                                                const file = event.currentTarget.files?.[0] ?? null;
                                                setUploadFile(file);
                                                setUploadName(file?.name ?? "");
                                            }}
                                        />
                                    </label>
                                    <label class="flex min-w-60 flex-1 flex-col gap-2 text-sm">
                                        <span class="text-muted">Asset name</span>
                                        <input
                                            class="rounded-lg border border-color bg-app px-3 py-2"
                                            value={uploadName()}
                                            onInput={(event) => setUploadName(event.currentTarget.value)}
                                            placeholder="release.tar.gz"
                                        />
                                    </label>
                                    <button class="btn btn-primary" disabled={!uploadFile() || isUploading()} onClick={() => void uploadAsset()}>
                                        <span class="flex items-center gap-2">
                                            <Upload size={14} />
                                            {isUploading() ? "Uploading..." : "Upload asset"}
                                        </span>
                                    </button>
                                </div>

                                <Show when={currentRelease().assets.length === 0}>
                                    <div class="rounded-lg border border-dashed border-color p-5 text-sm text-muted">
                                        No assets attached to this release yet.
                                    </div>
                                </Show>

                                <div class="flex flex-col">
                                    <For each={currentRelease().assets}>
                                        {(asset) => (
                                            <div class="release-asset-row flex flex-wrap items-center justify-between gap-4 py-4">
                                                <div class="flex min-w-0 flex-col gap-1">
                                                    <div class="flex flex-wrap items-center gap-2">
                                                        <span class="font-medium">{asset.name}</span>
                                                        <span class={`release-badge ${asset.status === "ready" ? "is-ready" : "is-pending"}`}>
                                                            {asset.status}
                                                        </span>
                                                    </div>
                                                    <div class="flex flex-wrap items-center gap-4 text-sm text-muted">
                                                        <span>{formatFileSize(asset.size)}</span>
                                                        <span>{asset.content_type}</span>
                                                        <span>{asset.download_count} downloads</span>
                                                    </div>
                                                </div>
                                                <div class="flex items-center gap-2">
                                                    <button
                                                        class="btn"
                                                        disabled={asset.status !== "ready"}
                                                        onClick={() => void downloadAsset(asset.id)}
                                                    >
                                                        <span class="flex items-center gap-2">
                                                            <Download size={14} />
                                                            Download
                                                        </span>
                                                    </button>
                                                    <button class="btn border border-red/20 text-red" onClick={() => void deleteAsset(asset.id)}>
                                                        <span class="flex items-center gap-2">
                                                            <Trash2 size={14} />
                                                            Delete
                                                        </span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </div>
                        </>
                    )}
                </Show>
            </div>
        </div>
    );
}
