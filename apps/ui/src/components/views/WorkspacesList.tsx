import { createEffect, createSignal, For, onMount, Show } from "solid-js";
import { Cloud, Loader2, Plus, RefreshCw, ShieldAlert, TerminalSquare, Trash2 } from "lucide-solid";
import { withAuthHeaders } from "../../lib/repoContext";
import { loadUserRepoOptions, parseRepoSelection, type RepoOption } from "../../lib/repoScopedResources";

type WorkspaceRecord = {
    id: string;
    name: string;
    status: string;
    is_fork: boolean;
    persistence?: string;
    idle_timeout_seconds?: number;
    created_at?: string;
    updated_at?: string;
    suspended_at?: string | null;
};

type WorkspaceSSHRecord = {
    command?: string;
    ssh_command?: string;
    ssh_host?: string;
    host?: string;
    port?: number;
    username?: string;
};

function formatTimestamp(timestamp?: string): string {
    if (!timestamp) return "Recently";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "Recently";
    return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

export default function WorkspacesList() {
    const [repoOptions, setRepoOptions] = createSignal<RepoOption[]>([]);
    const [selectedRepo, setSelectedRepo] = createSignal("");
    const [workspaces, setWorkspaces] = createSignal<WorkspaceRecord[]>([]);
    const [isLoadingRepos, setIsLoadingRepos] = createSignal(true);
    const [isLoadingWorkspaces, setIsLoadingWorkspaces] = createSignal(false);
    const [isSaving, setIsSaving] = createSignal(false);
    const [isCreating, setIsCreating] = createSignal(false);
    const [workspaceName, setWorkspaceName] = createSignal("");
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [successMessage, setSuccessMessage] = createSignal<string | null>(null);
    const [sshInfo, setSSHInfo] = createSignal<Record<string, WorkspaceSSHRecord>>({});
    const [sshErrors, setSSHErrors] = createSignal<Record<string, string>>({});

    const loadRepos = async () => {
        setIsLoadingRepos(true);
        setErrorMessage(null);
        try {
            const repos = await loadUserRepoOptions();
            setRepoOptions(repos);
            if (!selectedRepo() && repos.length > 0) {
                setSelectedRepo(repos[0].fullName);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load repositories";
            setErrorMessage(message);
        } finally {
            setIsLoadingRepos(false);
        }
    };

    const loadWorkspaces = async () => {
        const repoSelection = parseRepoSelection(selectedRepo());
        if (!repoSelection) {
            setWorkspaces([]);
            return;
        }

        setIsLoadingWorkspaces(true);
        setErrorMessage(null);
        try {
            const response = await fetch(`/api/repos/${encodeURIComponent(repoSelection.owner)}/${encodeURIComponent(repoSelection.repo)}/workspaces`, {
                credentials: "include",
                headers: withAuthHeaders(),
            });
            if (!response.ok) {
                throw new Error(`Failed to load workspaces (${response.status})`);
            }
            const body = (await response.json()) as WorkspaceRecord[];
            setWorkspaces(Array.isArray(body) ? body : []);
            setSSHInfo({});
            setSSHErrors({});
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load workspaces";
            setErrorMessage(message);
            setWorkspaces([]);
        } finally {
            setIsLoadingWorkspaces(false);
        }
    };

    onMount(() => {
        void loadRepos();
    });

    createEffect(() => {
        if (selectedRepo()) {
            void loadWorkspaces();
        }
    });

    const resetCreateForm = () => {
        setWorkspaceName("");
        setIsCreating(false);
    };

    const handleCreate = async (event: Event) => {
        event.preventDefault();
        const repoSelection = parseRepoSelection(selectedRepo());
        if (!repoSelection) {
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);
        setSuccessMessage(null);
        try {
            const response = await fetch(`/api/repos/${encodeURIComponent(repoSelection.owner)}/${encodeURIComponent(repoSelection.repo)}/workspaces`, {
                method: "POST",
                credentials: "include",
                headers: withAuthHeaders({
                    "Content-Type": "application/json",
                }),
                body: JSON.stringify({
                    name: workspaceName().trim(),
                }),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                const apiMessage = (body as { message?: string } | null)?.message;
                throw new Error(apiMessage ?? `Failed to create workspace (${response.status})`);
            }
            const created = (await response.json()) as WorkspaceRecord;
            setWorkspaces((current) => [created, ...current]);
            resetCreateForm();
            setSuccessMessage(`Created workspace ${created.id}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to create workspace";
            setErrorMessage(message);
        } finally {
            setIsSaving(false);
        }
    };

    const loadSSHInfo = async (workspaceID: string) => {
        const repoSelection = parseRepoSelection(selectedRepo());
        if (!repoSelection) {
            return;
        }

        setSSHErrors((current) => ({ ...current, [workspaceID]: "" }));
        try {
            const response = await fetch(`/api/repos/${encodeURIComponent(repoSelection.owner)}/${encodeURIComponent(repoSelection.repo)}/workspaces/${encodeURIComponent(workspaceID)}/ssh`, {
                credentials: "include",
                headers: withAuthHeaders(),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                const apiMessage = (body as { message?: string } | null)?.message;
                throw new Error(apiMessage ?? `Failed to load SSH info (${response.status})`);
            }
            const body = (await response.json()) as WorkspaceSSHRecord;
            setSSHInfo((current) => ({ ...current, [workspaceID]: body }));
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load SSH info";
            setSSHErrors((current) => ({ ...current, [workspaceID]: message }));
        }
    };

    const handleDelete = async (workspaceID: string) => {
        const repoSelection = parseRepoSelection(selectedRepo());
        if (!repoSelection) {
            return;
        }
        if (!confirm(`Delete workspace ${workspaceID}?`)) {
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);
        try {
            const response = await fetch(`/api/repos/${encodeURIComponent(repoSelection.owner)}/${encodeURIComponent(repoSelection.repo)}/workspaces/${encodeURIComponent(workspaceID)}`, {
                method: "DELETE",
                credentials: "include",
                headers: withAuthHeaders(),
            });
            if (!response.ok && response.status !== 204 && response.status !== 404) {
                throw new Error(`Failed to delete workspace (${response.status})`);
            }
            setWorkspaces((current) => current.filter((workspace) => workspace.id !== workspaceID));
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to delete workspace";
            setErrorMessage(message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div class="max-w-5xl mx-auto p-6 text-primary">
            <div class="flex items-start justify-between gap-4 mb-6">
                <div>
                    <h1 class="text-2xl font-semibold m-0">Cloud Workspaces</h1>
                    <p class="text-muted mt-2 mb-0">Create and inspect repo-scoped cloud workspaces backed by the workspace API.</p>
                </div>
                <div class="flex items-center gap-2">
                    <button class="btn" onClick={() => void loadWorkspaces()} disabled={isLoadingWorkspaces() || !selectedRepo()}>
                        <RefreshCw size={16} class={isLoadingWorkspaces() ? "animate-spin" : ""} />
                        Refresh
                    </button>
                    <button class="btn btn-primary" onClick={() => setIsCreating(true)} disabled={!selectedRepo()}>
                        <Plus size={16} />
                        New Workspace
                    </button>
                </div>
            </div>

            <Show when={errorMessage()}>
                {(message) => (
                    <div class="mb-4 rounded-lg border border-color bg-panel px-4 py-3 text-red flex items-center gap-2 shadow-sm">
                        <ShieldAlert size={16} class="opacity-80" />
                        <span class="text-sm font-medium opacity-90">{message()}</span>
                    </div>
                )}
            </Show>

            <Show when={successMessage()}>
                {(message) => (
                    <div class="mb-4 rounded-lg border border-green/30 bg-green/5 px-4 py-3 text-green">
                        {message()}
                    </div>
                )}
            </Show>

            <div class="rounded-xl border border-color bg-panel p-5 mb-6">
                <label for="repoSelector" class="block text-sm font-medium mb-2">Repository</label>
                <select
                    id="repoSelector"
                    class="w-full rounded-lg border border-color bg-app px-3 py-2 text-primary outline-none focus:border-blue"
                    value={selectedRepo()}
                    onChange={(event) => setSelectedRepo(event.currentTarget.value)}
                    disabled={isLoadingRepos()}
                >
                    <Show when={repoOptions().length > 0} fallback={<option value="">No repositories available</option>}>
                        <For each={repoOptions()}>
                            {(repo) => <option value={repo.fullName}>{repo.fullName}</option>}
                        </For>
                    </Show>
                </select>
                <p class="text-xs text-muted mt-2 mb-0">Workspace endpoints are repository-scoped, so this view aggregates workspaces by the selected repo.</p>
            </div>

            <Show when={isCreating()}>
                <form class="rounded-xl border border-color bg-panel p-5 mb-6" onSubmit={(event) => void handleCreate(event)}>
                    <div class="flex items-center gap-2 mb-4">
                        <Cloud size={18} class="text-cyan" />
                        <h2 class="text-lg font-medium m-0">Create workspace</h2>
                    </div>
                    <div>
                        <label for="workspaceName" class="block text-sm font-medium mb-2">Name</label>
                        <input
                            id="workspaceName"
                            type="text"
                            value={workspaceName()}
                            onInput={(event) => setWorkspaceName(event.currentTarget.value)}
                            class="w-full rounded-lg border border-color bg-app px-3 py-2 text-primary outline-none focus:border-blue"
                            placeholder="e.g. primary"
                        />
                    </div>
                    <div class="flex items-center gap-2 mt-4">
                        <button type="button" class="btn" onClick={resetCreateForm}>Cancel</button>
                        <button type="submit" class="btn btn-primary" disabled={isSaving() || !selectedRepo()}>
                            {isSaving() ? "Creating..." : "Create Workspace"}
                        </button>
                    </div>
                </form>
            </Show>

            <div class="rounded-xl border border-color bg-root overflow-hidden">
                <Show when={!isLoadingWorkspaces()} fallback={
                    <div class="flex items-center justify-center gap-2 p-8 text-muted">
                        <Loader2 size={16} class="animate-spin" />
                        <span>Loading workspaces...</span>
                    </div>
                }>
                    <Show when={workspaces().length > 0} fallback={
                        <div class="empty-state flex flex-col items-center justify-center p-16 text-muted mt-4 rounded-xl border border-dashed border-color" style={{ "background": "rgba(255,255,255,0.02)" }}>
                            <div class="mb-4 bg-app border border-color rounded-2xl p-5 flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.1)] transition-transform hover:scale-105">
                                <Cloud size={28} class="text-primary opacity-80" />
                            </div>
                            <h3 class="font-semibold text-primary text-lg mb-1">No workspaces found</h3>
                            <p class="text-sm max-w-[340px] text-center mb-6">There are no designated cloud workspaces in this repository. Create a new workspace to get started with an integrated terminal.</p>
                            <button class="btn btn-primary" onClick={() => setIsCreating(true)} disabled={!selectedRepo()}>
                                <Plus size={16} />
                                Create Workspace
                            </button>
                        </div>
                    }>
                        <For each={workspaces()}>
                            {(workspace) => (
                                <div class="workspace-row border-b border-light px-5 py-4 last:border-b-0">
                                    <div class="flex items-start justify-between gap-4">
                                        <div class="min-w-0">
                                            <div class="flex items-center gap-2 flex-wrap">
                                                <span class="font-medium">{workspace.name || workspace.id}</span>
                                                <span class="rounded-full border border-color px-2 py-0.5 text-xs uppercase tracking-wide text-muted">
                                                    {workspace.status}
                                                </span>
                                                <Show when={workspace.is_fork}>
                                                    <span class="rounded-full border border-color px-2 py-0.5 text-xs text-muted">Fork</span>
                                                </Show>
                                            </div>
                                            <div class="text-sm text-muted mt-1">Workspace ID: {workspace.id}</div>
                                            <div class="text-sm text-muted mt-1">
                                                Persistence: {workspace.persistence ?? "persistent"} · Idle timeout: {workspace.idle_timeout_seconds ?? 1800}s
                                            </div>
                                            <div class="text-xs text-muted mt-1">Updated {formatTimestamp(workspace.updated_at ?? workspace.created_at)}</div>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <a class="btn" href={`/${parseRepoSelection(selectedRepo())?.owner}/${parseRepoSelection(selectedRepo())?.repo}/terminal?workspaceId=${workspace.id}`}>
                                                <TerminalSquare size={16} />
                                                Terminal
                                            </a>
                                            <button class="btn" onClick={() => void loadSSHInfo(workspace.id)}>
                                                <TerminalSquare size={16} />
                                                SSH
                                            </button>
                                            <button class="btn" aria-label="Delete workspace" onClick={() => void handleDelete(workspace.id)} disabled={isSaving()}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <Show when={sshInfo()[workspace.id]}>
                                        {(info) => (
                                            <div class="mt-4 rounded-lg border border-color bg-panel px-4 py-3 text-sm">
                                                <div class="font-medium mb-1">SSH connection</div>
                                                <div class="break-all text-muted">{info().command ?? info().ssh_command ?? info().ssh_host ?? "SSH details available"}</div>
                                            </div>
                                        )}
                                    </Show>
                                    <Show when={sshErrors()[workspace.id]}>
                                        {(message) => (
                                            <div class="mt-4 rounded-lg border border-red/30 bg-red/5 px-4 py-3 text-sm text-red">
                                                {message()}
                                            </div>
                                        )}
                                    </Show>
                                </div>
                            )}
                        </For>
                    </Show>
                </Show>
            </div>
        </div>
    );
}
