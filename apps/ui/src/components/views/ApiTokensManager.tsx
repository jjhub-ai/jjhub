import { createSignal, For, onMount, Show } from "solid-js";
import { KeyRound, Plus, Trash2, Clock, CheckCircle2, Shield, Copy, AlertTriangle } from "lucide-solid";
import { withAuthHeaders } from "../../lib/repoContext";
import "./ApiTokensManager.css";

type ApiToken = {
    id: number;
    name: string;
    token_last_eight: string;
    scopes: string[];
    created_at?: string;
};

// Available scopes based on API implementation
const AVAILABLE_SCOPES = [
    { id: "read:repository", label: "Read Repository", desc: "Grants read-only access to repositories" },
    { id: "write:repository", label: "Write Repository", desc: "Grants read/write access to repositories" },
    { id: "read:user", label: "Read User", desc: "Grants read-only access to user profile data" },
    { id: "write:user", label: "Write User", desc: "Grants read/write access to user profile data" },
    { id: "admin", label: "Admin", desc: "Full administrative access to all resources (requires admin rights)" },
];

function formatTime(timestamp?: string): string {
    if (!timestamp) return "Recently";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 86400000) return "Today";
    if (diff < 172800000) return "Yesterday";
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function ApiTokensManager() {
    const [tokens, setTokens] = createSignal<ApiToken[]>([]);
    const [isAdding, setIsAdding] = createSignal(false);
    const [isLoading, setIsLoading] = createSignal(true);
    const [isSaving, setIsSaving] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

    // Form state
    const [newTokenName, setNewTokenName] = createSignal("");
    const [selectedScopes, setSelectedScopes] = createSignal<string[]>(["read:repository"]);

    // Newly generated token state
    const [generatedToken, setGeneratedToken] = createSignal<string | null>(null);
    const [copiedToken, setCopiedToken] = createSignal(false);

    const loadTokens = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const response = await fetch("/api/user/tokens", {
                credentials: "include",
                headers: withAuthHeaders(),
            });
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error("Authentication required to view tokens.");
                }
                throw new Error(`Failed to load API tokens (${response.status})`);
            }
            const body = (await response.json()) as ApiToken[];
            setTokens(Array.isArray(body) ? body : []);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load API tokens";
            setErrorMessage(message);
            setTokens([]);
        } finally {
            setIsLoading(false);
        }
    };

    onMount(() => {
        void loadTokens();
    });

    const toggleScope = (scope: string) => {
        setSelectedScopes(prev =>
            prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
        );
    };

    const handleCreateToken = async (e: Event) => {
        e.preventDefault();
        if (!newTokenName() || selectedScopes().length === 0) return;

        setIsSaving(true);
        setErrorMessage(null);
        setGeneratedToken(null);

        try {
            const response = await fetch("/api/user/tokens", {
                method: "POST",
                credentials: "include",
                headers: withAuthHeaders({
                    "Content-Type": "application/json",
                }),
                body: JSON.stringify({
                    name: newTokenName(),
                    scopes: selectedScopes(),
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || `Failed to create token (${response.status})`);
            }

            const created = await response.json();

            // Show the raw token to the user
            setGeneratedToken(created.token);

            // Add the new token to the list (backend doesn't return raw token in the list)
            setTokens(current => [{
                id: created.id,
                name: created.name,
                token_last_eight: created.token_last_eight,
                scopes: created.scopes,
                created_at: new Date().toISOString()
            }, ...current]);

            // Reset form but keep isAdding true to show the generated token
            setNewTokenName("");
            setSelectedScopes(["read:repository"]);

        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to create API token";
            setErrorMessage(message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to revoke this token? Any applications using it will lose access immediately.")) {
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);
        try {
            let response: Response | null = null;
            for (let attempt = 0; attempt < 2; attempt += 1) {
                response = await fetch(`/api/user/tokens/${id}`, {
                    method: "DELETE",
                    credentials: "include",
                    headers: withAuthHeaders(),
                });
                if (response.status !== 429) break;

                const retryAfterHeader = response.headers.get("Retry-After");
                const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : Number.NaN;
                const retryDelay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
                    ? retryAfterSeconds * 1000
                    : 2000;
                await delay(retryDelay);
            }

            if (response === null) {
                throw new Error("Failed to delete token");
            }
            if (!response.ok && response.status !== 204 && response.status !== 404) {
                throw new Error(`Failed to delete token (${response.status})`);
            }
            setTokens(current => current.filter(t => t.id !== id));
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to delete token";
            setErrorMessage(message);
        } finally {
            setIsSaving(false);
        }
    };

    const copyToClipboard = () => {
        const token = generatedToken();
        if (!token) return;

        navigator.clipboard.writeText(token).then(() => {
            setCopiedToken(true);
            setTimeout(() => setCopiedToken(false), 2000);
        });
    };

    const resetForm = () => {
        setIsAdding(false);
        setNewTokenName("");
        setSelectedScopes(["read:repository"]);
        setGeneratedToken(null);
        setCopiedToken(false);
        setErrorMessage(null);
    };

    return (
        <div class="settings-page">
            <header class="settings-header animate-in stagger-1">
                <div>
                    <h1>Personal Access Tokens</h1>
                    <p class="text-muted">Tokens that can be used to authenticate with the JJHub API or CLI.</p>
                </div>

                <Show when={!isAdding()}>
                    <button class="primary-btn" onClick={() => setIsAdding(true)}>
                        <Plus size={16} />
                        Generate New Token
                    </button>
                </Show>
            </header>

            <Show when={errorMessage()}>
                {(message) => <p class="text-red mb-4">{message()}</p>}
            </Show>

            <Show when={isAdding()}>
                <div class="add-token-card animate-in stagger-2">
                    <Show when={generatedToken()} fallback={
                        <form onSubmit={handleCreateToken} class="add-token-form">
                            <div class="card-header border-b border-color pb-4 mb-4">
                                <div class="flex items-center gap-2">
                                    <KeyRound size={18} class="text-blue" />
                                    <h2 class="text-lg font-medium text-primary m-0">Generate new token</h2>
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="tokenName">Note</label>
                                <input
                                    type="text"
                                    id="tokenName"
                                    placeholder="What's this token for?"
                                    value={newTokenName()}
                                    onInput={(e) => setNewTokenName(e.currentTarget.value)}
                                    autofocus
                                    required
                                />
                            </div>

                            <div class="form-group mt-6">
                                <label class="mb-3">Select Scopes</label>
                                <div class="scopes-grid">
                                    <For each={AVAILABLE_SCOPES}>
                                        {(scope) => (
                                            <label class={`scope-card ${selectedScopes().includes(scope.id) ? 'selected' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedScopes().includes(scope.id)}
                                                    onChange={() => toggleScope(scope.id)}
                                                    class="hidden"
                                                />
                                                <div class="scope-checkbox">
                                                    <Show when={selectedScopes().includes(scope.id)}>
                                                        <CheckCircle2 size={14} class="text-white" />
                                                    </Show>
                                                </div>
                                                <div class="scope-info">
                                                    <span class="scope-name flex items-center gap-2">
                                                        {scope.label}
                                                        <Show when={scope.id === 'admin'}>
                                                            <Shield size={12} class="text-red" />
                                                        </Show>
                                                    </span>
                                                    <span class="scope-desc text-muted">{scope.desc}</span>
                                                </div>
                                            </label>
                                        )}
                                    </For>
                                </div>
                            </div>

                            <div class="form-actions border-t border-color pt-4 mt-6">
                                <button type="button" class="secondary-btn" onClick={resetForm} disabled={isSaving()}>
                                    Cancel
                                </button>
                                <button type="submit" class="primary-btn" disabled={!newTokenName() || selectedScopes().length === 0 || isSaving()}>
                                    {isSaving() ? "Generating..." : "Generate Token"}
                                </button>
                            </div>
                        </form>
                    }>
                        <div class="generated-token-view">
                            <div class="flex items-start gap-3 p-4 bg-yellow/10 border border-yellow/30 rounded-lg text-yellow mb-6">
                                <AlertTriangle size={20} class="flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 class="font-medium mb-1 mt-0">Make sure to copy your personal access token now</h3>
                                    <p class="text-sm m-0 opacity-90">You won't be able to see it again!</p>
                                </div>
                            </div>

                            <div class="token-display bg-app border border-color rounded-lg p-1 flex items-center mb-6">
                                <code class="text-green text-lg px-4 py-2 flex-1 font-mono break-all overflow-hidden">{generatedToken()}</code>
                                <button class="btn btn-secondary flex items-center gap-2" onClick={copyToClipboard}>
                                    <Show when={copiedToken()} fallback={<Copy size={16} />}>
                                        <CheckCircle2 size={16} class="text-green" />
                                    </Show>
                                    {copiedToken() ? "Copied!" : "Copy"}
                                </button>
                            </div>

                            <div class="flex justify-end">
                                <button class="primary-btn" onClick={resetForm}>
                                    I have copied the token
                                </button>
                            </div>
                        </div>
                    </Show>
                </div>
            </Show>

            <div class="tokens-list animate-in stagger-3">
                <Show when={isLoading()}>
                    <div class="empty-tokens p-8 text-center bg-panel border border-color rounded-xl mt-6">
                        <h3 class="text-primary font-medium mt-0 mb-2">Loading API tokens...</h3>
                    </div>
                </Show>

                <Show when={!isLoading() && tokens().length === 0}>
                    <div class="empty-tokens p-12 text-center bg-panel border border-color rounded-xl mt-6 flex flex-col items-center justify-center">
                        <KeyRound size={32} class="text-muted mb-4 opacity-50" />
                        <h3 class="text-primary font-medium mt-0 mb-2">No personal access tokens</h3>
                        <p class="text-muted m-0 text-sm max-w-sm">Personal access tokens function like ordinary OAuth access tokens. They can be used to authenticate to the API over Basic Authentication.</p>
                    </div>
                </Show>

                <Show when={!isLoading() && tokens().length > 0}>
                    <div class="flex flex-col gap-3 mt-6">
                        <For each={tokens()}>
                            {(token) => (
                                <div class="token-row border border-color rounded-lg bg-panel p-4 flex items-center justify-between group transition-colors hover:border-blue/50">
                                    <div class="flex items-start gap-4 flex-1 overflow-hidden">
                                        <div class="text-blue mt-1 flex-shrink-0">
                                            <KeyRound size={20} />
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2 mb-1 overflow-hidden">
                                                <h3 class="text-primary font-medium text-base m-0 truncate">{token.name}</h3>
                                                <code class="text-xs bg-black/30 px-2 py-0.5 rounded text-muted font-mono whitespace-nowrap">
                                                    jjhub_...{token.token_last_eight}
                                                </code>
                                            </div>

                                            <div class="flex flex-wrap items-center gap-3 text-sm text-muted">
                                                <div class="flex items-center gap-1.5 whitespace-nowrap">
                                                    <Clock size={12} />
                                                    Created {formatTime(token.created_at)}
                                                </div>
                                                <span class="text-color opacity-30">•</span>
                                                <div class="flex items-center gap-1.5 overflow-hidden">
                                                    <Shield size={12} />
                                                    <span class="truncate">{token.scopes.join(", ")}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                                        <button
                                            class="p-2 text-muted hover:text-red hover:bg-red/10 rounded-md transition-colors"
                                            onClick={() => void handleDelete(token.id)}
                                            title="Revoke token"
                                            disabled={isSaving()}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </Show>
            </div>
        </div>
    );
}
