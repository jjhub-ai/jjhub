import { useParams } from "@solidjs/router";
import { createSignal, For, onMount, Show } from "solid-js";
import { Key, Lock, Plus, Shield, Trash2, Unlock } from "lucide-solid";
import { withAuthHeaders } from "../../lib/repoContext";
import "./FeatureSurface.css";
import { formatDateTime, readErrorMessage } from "./viewSupport";

type DeployKey = {
    id: number;
    title: string;
    key_fingerprint: string;
    public_key: string;
    key_type: string;
    read_only: boolean;
    created_at: string;
};

export default function RepoDeployKeysView() {
    const params = useParams<{ owner: string; repo: string }>();
    const owner = () => params.owner ?? "";
    const repo = () => params.repo ?? "";
    const endpoint = () => `/api/repos/${owner()}/${repo()}/keys`;

    const [keys, setKeys] = createSignal<DeployKey[]>([]);
    const [isLoading, setIsLoading] = createSignal(true);
    const [isSaving, setIsSaving] = createSignal(false);
    const [isAdding, setIsAdding] = createSignal(false);
    const [title, setTitle] = createSignal("");
    const [keyValue, setKeyValue] = createSignal("");
    const [readOnly, setReadOnly] = createSignal(true);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [notice, setNotice] = createSignal<string | null>(null);

    const loadKeys = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const response = await fetch(endpoint(), {
                credentials: "include",
                headers: withAuthHeaders(),
            });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, "Failed to load deploy keys"));
            }
            const payload = (await response.json()) as DeployKey[];
            setKeys(Array.isArray(payload) ? payload : []);
        } catch (error) {
            setKeys([]);
            setErrorMessage(error instanceof Error ? error.message : "Failed to load deploy keys");
        } finally {
            setIsLoading(false);
        }
    };

    onMount(() => {
        void loadKeys();
    });

    const resetForm = () => {
        setIsAdding(false);
        setTitle("");
        setKeyValue("");
        setReadOnly(true);
    };

    const createKey = async (event: Event) => {
        event.preventDefault();
        if (!title().trim() || !keyValue().trim()) {
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);
        setNotice(null);
        try {
            const response = await fetch(endpoint(), {
                method: "POST",
                credentials: "include",
                headers: withAuthHeaders({
                    "Content-Type": "application/json",
                }),
                body: JSON.stringify({
                    title: title().trim(),
                    key: keyValue().trim(),
                    read_only: readOnly(),
                }),
            });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, "Failed to add deploy key"));
            }
            const created = (await response.json()) as DeployKey;
            setKeys((current) => [created, ...current.filter((entry) => entry.id !== created.id)]);
            setNotice(`Added deploy key ${created.title}.`);
            resetForm();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to add deploy key");
        } finally {
            setIsSaving(false);
        }
    };

    const deleteKey = async (key: DeployKey) => {
        if (!confirm(`Delete deploy key ${key.title}?`)) {
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);
        setNotice(null);
        try {
            const response = await fetch(`${endpoint()}/${key.id}`, {
                method: "DELETE",
                credentials: "include",
                headers: withAuthHeaders(),
            });
            if (!response.ok && response.status !== 204) {
                throw new Error(await readErrorMessage(response, "Failed to delete deploy key"));
            }
            setKeys((current) => current.filter((entry) => entry.id !== key.id));
            setNotice(`Deleted deploy key ${key.title}.`);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to delete deploy key");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div class="surface-page">
            <header class="surface-header">
                <div>
                    <h1>Deploy Keys</h1>
                    <p>Manage SSH credentials scoped to {owner()}/{repo()} for automation, mirrors, and external deploy targets.</p>
                </div>
                <div class="surface-actions">
                    <Show when={!isAdding()}>
                        <button class="primary-btn" onClick={() => setIsAdding(true)}>
                            <Plus size={16} />
                            Add Deploy Key
                        </button>
                    </Show>
                </div>
            </header>

            <Show when={errorMessage()}>
                {(message) => <div class="surface-banner error">{message()}</div>}
            </Show>
            <Show when={notice()}>
                {(message) => <div class="surface-banner success">{message()}</div>}
            </Show>

            <Show when={isAdding()}>
                <form class="surface-card surface-form" onSubmit={createKey}>
                    <div class="surface-card-header">
                        <div>
                            <h2>Add deploy key</h2>
                            <p>Deploy keys are repository-scoped and require repository admin access.</p>
                        </div>
                        <Shield size={20} class="text-muted" />
                    </div>

                    <div class="surface-inline-fields">
                        <div class="surface-field">
                            <label for="deploy-key-title">Title</label>
                            <input
                                id="deploy-key-title"
                                type="text"
                                value={title()}
                                onInput={(event) => setTitle(event.currentTarget.value)}
                                placeholder="Production deploy bot"
                                autofocus
                                required
                            />
                        </div>
                    </div>

                    <div class="surface-field">
                        <label for="deploy-key-body">Public key</label>
                        <textarea
                            id="deploy-key-body"
                            value={keyValue()}
                            onInput={(event) => setKeyValue(event.currentTarget.value)}
                            placeholder="ssh-ed25519 AAAAC3..."
                            required
                        />
                    </div>

                    <label class="surface-checkbox">
                        <input
                            type="checkbox"
                            checked={readOnly()}
                            onChange={(event) => setReadOnly(event.currentTarget.checked)}
                        />
                        <div>
                            <strong>Read-only access</strong>
                            <p>Disable this for write-capable deploy keys used by mirroring or CI systems.</p>
                        </div>
                    </label>

                    <div class="surface-form-actions">
                        <button type="button" class="secondary-btn" onClick={resetForm} disabled={isSaving()}>
                            Cancel
                        </button>
                        <button type="submit" class="primary-btn" disabled={isSaving() || !title().trim() || !keyValue().trim()}>
                            {isSaving() ? "Adding..." : "Add Deploy Key"}
                        </button>
                    </div>
                </form>
            </Show>

            <Show when={isLoading()}>
                <div class="surface-empty">
                    <h3>Loading deploy keys...</h3>
                </div>
            </Show>

            <Show when={!isLoading() && keys().length === 0}>
                <div class="surface-empty">
                    <Key size={32} />
                    <h3>No deploy keys</h3>
                    <p>Add a repository-scoped SSH key for CI, production deploys, or mirrors.</p>
                </div>
            </Show>

            <Show when={!isLoading() && keys().length > 0}>
                <div class="surface-list">
                    <For each={keys()}>
                        {(key) => (
                            <div class="surface-row">
                                <div class="surface-row-main">
                                    <div class="surface-row-title">
                                        <h3>{key.title}</h3>
                                        <span class="surface-tag">
                                            {key.read_only ? <Lock size={12} /> : <Unlock size={12} />}
                                            {key.read_only ? "Read-only" : "Read / write"}
                                        </span>
                                    </div>
                                    <div class="surface-meta">
                                        <span class="surface-code">{key.key_fingerprint}</span>
                                        <span>{key.key_type}</span>
                                        <span>Added {formatDateTime(key.created_at)}</span>
                                    </div>
                                    <span class="surface-code">{key.public_key}</span>
                                </div>
                                <div class="surface-row-actions">
                                    <button class="danger-btn" disabled={isSaving()} onClick={() => void deleteKey(key)} title="Delete deploy key">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </For>
                </div>
            </Show>
        </div>
    );
}
