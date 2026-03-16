import { createEffect, createSignal, For, onMount, Show } from "solid-js";
import { EyeOff, KeyRound, Loader2, Plus, RefreshCw, ShieldAlert, Trash2 } from "lucide-solid";
import { withAuthHeaders } from "../../lib/repoContext";
import { loadUserRepoOptions, parseRepoSelection, type RepoOption } from "../../lib/repoScopedResources";

type SecretRecord = {
    name: string;
    created_at?: string;
    updated_at?: string;
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

export default function SecretsManager() {
    const [repoOptions, setRepoOptions] = createSignal<RepoOption[]>([]);
    const [selectedRepo, setSelectedRepo] = createSignal("");
    const [secrets, setSecrets] = createSignal<SecretRecord[]>([]);
    const [isLoadingRepos, setIsLoadingRepos] = createSignal(true);
    const [isLoadingSecrets, setIsLoadingSecrets] = createSignal(false);
    const [isSaving, setIsSaving] = createSignal(false);
    const [isAdding, setIsAdding] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [successMessage, setSuccessMessage] = createSignal<string | null>(null);
    const [secretName, setSecretName] = createSignal("");
    const [secretValue, setSecretValue] = createSignal("");

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

    const loadSecrets = async () => {
        const repoSelection = parseRepoSelection(selectedRepo());
        if (!repoSelection) {
            setSecrets([]);
            return;
        }

        setIsLoadingSecrets(true);
        setErrorMessage(null);
        try {
            const response = await fetch(`/api/repos/${encodeURIComponent(repoSelection.owner)}/${encodeURIComponent(repoSelection.repo)}/secrets`, {
                credentials: "include",
                headers: withAuthHeaders(),
            });
            if (!response.ok) {
                throw new Error(`Failed to load secrets (${response.status})`);
            }
            const body = (await response.json()) as SecretRecord[];
            setSecrets(Array.isArray(body) ? body : []);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load secrets";
            setErrorMessage(message);
            setSecrets([]);
        } finally {
            setIsLoadingSecrets(false);
        }
    };

    onMount(() => {
        void loadRepos();
    });

    createEffect(() => {
        if (selectedRepo()) {
            void loadSecrets();
        }
    });

    const resetForm = () => {
        setIsAdding(false);
        setSecretName("");
        setSecretValue("");
    };

    const handleCreate = async (event: Event) => {
        event.preventDefault();
        const repoSelection = parseRepoSelection(selectedRepo());
        if (!repoSelection || !secretName().trim() || !secretValue()) {
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);
        setSuccessMessage(null);
        try {
            const response = await fetch(`/api/repos/${encodeURIComponent(repoSelection.owner)}/${encodeURIComponent(repoSelection.repo)}/secrets`, {
                method: "POST",
                credentials: "include",
                headers: withAuthHeaders({
                    "Content-Type": "application/json",
                }),
                body: JSON.stringify({
                    name: secretName().trim(),
                    value: secretValue(),
                }),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                const apiMessage = (body as { message?: string } | null)?.message;
                throw new Error(apiMessage ?? `Failed to save secret (${response.status})`);
            }
            const saved = (await response.json()) as SecretRecord;
            setSecrets((current) => {
                const next = current.filter((secret) => secret.name !== saved.name);
                return [saved, ...next].sort((left, right) => left.name.localeCompare(right.name));
            });
            setSuccessMessage(`Saved secret ${saved.name}`);
            resetForm();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to save secret";
            setErrorMessage(message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (name: string) => {
        const repoSelection = parseRepoSelection(selectedRepo());
        if (!repoSelection) {
            return;
        }
        if (!confirm(`Delete secret ${name}?`)) {
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);
        setSuccessMessage(null);
        try {
            const response = await fetch(`/api/repos/${encodeURIComponent(repoSelection.owner)}/${encodeURIComponent(repoSelection.repo)}/secrets/${encodeURIComponent(name)}`, {
                method: "DELETE",
                credentials: "include",
                headers: withAuthHeaders(),
            });
            if (!response.ok && response.status !== 204 && response.status !== 404) {
                throw new Error(`Failed to delete secret (${response.status})`);
            }
            setSecrets((current) => current.filter((secret) => secret.name !== name));
            setSuccessMessage(`Deleted secret ${name}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to delete secret";
            setErrorMessage(message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div class="max-w-5xl mx-auto p-6 text-primary">
            <div class="flex items-start justify-between gap-4 mb-6">
                <div>
                    <h1 class="text-2xl font-semibold m-0">Secrets</h1>
                    <p class="text-muted mt-2 mb-0">Manage repository-scoped encrypted secrets for workflows and agent execution.</p>
                </div>
                <div class="flex items-center gap-2">
                    <button class="btn" onClick={() => void loadSecrets()} disabled={isLoadingSecrets() || !selectedRepo()}>
                        <RefreshCw size={16} class={isLoadingSecrets() ? "animate-spin" : ""} />
                        Refresh
                    </button>
                    <button class="btn btn-primary" onClick={() => setIsAdding(true)} disabled={!selectedRepo()}>
                        <Plus size={16} />
                        New Secret
                    </button>
                </div>
            </div>

            <Show when={errorMessage()}>
                {(message) => (
                    <div class="mb-4 rounded-lg border border-red/30 bg-red/5 px-4 py-3 text-red flex items-center gap-2">
                        <ShieldAlert size={16} />
                        <span>{message()}</span>
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
                <p class="text-xs text-muted mt-2 mb-0">Secrets are scoped to a single repository and are never returned with their plaintext value.</p>
            </div>

            <Show when={isAdding()}>
                <form class="rounded-xl border border-color bg-panel p-5 mb-6" onSubmit={(event) => void handleCreate(event)}>
                    <div class="flex items-center gap-2 mb-4">
                        <KeyRound size={18} class="text-yellow" />
                        <h2 class="text-lg font-medium m-0">Save secret</h2>
                    </div>
                    <div class="grid gap-4 md:grid-cols-2">
                        <div>
                            <label for="secretName" class="block text-sm font-medium mb-2">Name</label>
                            <input
                                id="secretName"
                                type="text"
                                value={secretName()}
                                onInput={(event) => setSecretName(event.currentTarget.value)}
                                class="w-full rounded-lg border border-color bg-app px-3 py-2 text-primary outline-none focus:border-blue"
                                placeholder="e.g. OPENAI_API_KEY"
                                required
                            />
                        </div>
                        <div>
                            <label for="secretValue" class="block text-sm font-medium mb-2">Value</label>
                            <input
                                id="secretValue"
                                type="password"
                                value={secretValue()}
                                onInput={(event) => setSecretValue(event.currentTarget.value)}
                                class="w-full rounded-lg border border-color bg-app px-3 py-2 text-primary outline-none focus:border-blue"
                                placeholder="Paste the secret value"
                                required
                            />
                        </div>
                    </div>
                    <div class="flex items-center gap-2 mt-4">
                        <button type="button" class="btn" onClick={resetForm}>Cancel</button>
                        <button type="submit" class="btn btn-primary" disabled={isSaving() || !selectedRepo()}>
                            {isSaving() ? "Saving..." : "Save Secret"}
                        </button>
                    </div>
                </form>
            </Show>

            <div class="rounded-xl border border-color bg-root overflow-hidden">
                <Show when={!isLoadingSecrets()} fallback={
                    <div class="flex items-center justify-center gap-2 p-8 text-muted">
                        <Loader2 size={16} class="animate-spin" />
                        <span>Loading secrets...</span>
                    </div>
                }>
                    <Show when={secrets().length > 0} fallback={
                        <div class="p-8 text-center text-muted">
                            <EyeOff size={24} class="mx-auto mb-3 opacity-60" />
                            <p class="m-0">No secrets configured for this repository.</p>
                        </div>
                    }>
                        <For each={secrets()}>
                            {(secret) => (
                                <div class="config-row flex items-center justify-between gap-4 border-b border-light px-5 py-4 last:border-b-0">
                                    <div class="min-w-0">
                                        <div class="font-medium">{secret.name}</div>
                                        <div class="text-sm text-muted">Updated {formatTimestamp(secret.updated_at ?? secret.created_at)}</div>
                                    </div>
                                    <button
                                        class="btn"
                                        aria-label="Delete secret"
                                        onClick={() => void handleDelete(secret.name)}
                                        disabled={isSaving()}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            )}
                        </For>
                    </Show>
                </Show>
            </div>
        </div>
    );
}
