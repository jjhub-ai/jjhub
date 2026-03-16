import { createSignal, For, onMount, Show } from "solid-js";
import { Key, Plus, Trash2, Clock, CheckCircle2 } from "lucide-solid";
import { withAuthHeaders } from "../../lib/repoContext";
import "./SSHKeysManager.css";

type SSHKey = {
    id: number;
    title: string;
    fingerprint: string;
    keyType: string;
    createdAt: string;
    lastUsed: string | null;
};

type SSHKeyAPI = {
    id: number;
    name: string;
    fingerprint: string;
    key_type: string;
    created_at: string;
};

function formatTime(timestamp: string | null): string {
    if (!timestamp) return "Never";

    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 86400000) return "Today";
    if (diff < 172800000) return "Yesterday";

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SSHKeysManager() {
    const [keys, setKeys] = createSignal<SSHKey[]>([]);
    const [isAdding, setIsAdding] = createSignal(false);
    const [isLoading, setIsLoading] = createSignal(true);
    const [isSaving, setIsSaving] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

    // Form state
    const [newTitle, setNewTitle] = createSignal("");
    const [newKey, setNewKey] = createSignal("");

    const mapKey = (row: SSHKeyAPI): SSHKey => ({
        id: row.id,
        title: row.name,
        fingerprint: row.fingerprint,
        keyType: row.key_type,
        createdAt: row.created_at,
        lastUsed: null,
    });

    const loadKeys = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const response = await fetch("/api/user/keys", {
                credentials: "include",
                headers: withAuthHeaders(),
            });
            if (!response.ok) {
                throw new Error(`Failed to load SSH keys (${response.status})`);
            }
            const body = (await response.json()) as SSHKeyAPI[];
            setKeys(Array.isArray(body) ? body.map(mapKey) : []);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load SSH keys";
            setErrorMessage(message);
            setKeys([]);
        } finally {
            setIsLoading(false);
        }
    };

    onMount(() => {
        void loadKeys();
    });

    const handleAddKey = async (e: Event) => {
        e.preventDefault();
        if (!newTitle() || !newKey()) return;

        setIsSaving(true);
        setErrorMessage(null);
        try {
            const response = await fetch("/api/user/keys", {
                method: "POST",
                credentials: "include",
                headers: withAuthHeaders({
                    "Content-Type": "application/json",
                }),
                body: JSON.stringify({
                    title: newTitle(),
                    key: newKey(),
                }),
            });
            if (!response.ok) {
                throw new Error(`Failed to create SSH key (${response.status})`);
            }

            const created = (await response.json()) as SSHKeyAPI;
            setKeys((current) => [mapKey(created), ...current]);
            setNewTitle("");
            setNewKey("");
            setIsAdding(false);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to create SSH key";
            setErrorMessage(message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        setIsSaving(true);
        setErrorMessage(null);
        try {
            const response = await fetch(`/api/user/keys/${id}`, {
                method: "DELETE",
                credentials: "include",
                headers: withAuthHeaders(),
            });
            if (!response.ok) {
                throw new Error(`Failed to delete SSH key (${response.status})`);
            }
            setKeys((current) => current.filter((key) => key.id !== id));
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to delete SSH key";
            setErrorMessage(message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div class="settings-page">
            <header class="settings-header animate-in stagger-1">
                <div>
                    <h1>SSH Keys</h1>
                    <p class="text-muted">Manage the SSH keys associated with your account.</p>
                </div>

                <Show when={!isAdding()}>
                    <button class="primary-btn" onClick={() => setIsAdding(true)}>
                        <Plus size={16} />
                        New SSH Key
                    </button>
                </Show>
            </header>

            <Show when={errorMessage()}>
                {(message) => <p class="text-red mb-4">{message()}</p>}
            </Show>

            <Show when={isAdding()}>
                <div class="add-key-card animate-in stagger-2">
                    <div class="card-header">
                        <Key size={18} class="text-blue" />
                        <h2>Add new SSH key</h2>
                    </div>

                    <form onSubmit={handleAddKey} class="add-key-form">
                        <div class="form-group">
                            <label for="keyTitle">Title</label>
                            <input
                                type="text"
                                id="keyTitle"
                                placeholder="e.g. Personal MacBook Air"
                                value={newTitle()}
                                onInput={(e) => setNewTitle(e.currentTarget.value)}
                                autofocus
                                required
                            />
                        </div>

                        <div class="form-group">
                            <label for="keyContent">Key</label>
                            <textarea
                                id="keyContent"
                                placeholder="Begins with 'ssh-ed25519', 'ssh-rsa', etc."
                                value={newKey()}
                                onInput={(e) => setNewKey(e.currentTarget.value)}
                                rows={4}
                                required
                            />
                        </div>

                        <div class="form-actions">
                            <button type="button" class="secondary-btn" onClick={() => {
                                setIsAdding(false);
                                setNewTitle("");
                                setNewKey("");
                            }}>
                                Cancel
                            </button>
                            <button type="submit" class="primary-btn" disabled={!newTitle() || !newKey()}>
                                {isSaving() ? "Adding..." : "Add Key"}
                            </button>
                        </div>
                    </form>
                </div>
            </Show>

            <div class="keys-list animate-in stagger-3">
                <Show when={isLoading()}>
                    <div class="empty-keys">
                        <h3>Loading SSH keys...</h3>
                    </div>
                </Show>

                <Show when={keys().length === 0}>
                    <div class="empty-keys">
                        <Key size={32} class="text-muted mb-4" />
                        <h3>No SSH keys found</h3>
                        <p class="text-muted">There are no SSH keys associated with your account.</p>
                    </div>
                </Show>

                <For each={keys()}>
                    {(key) => (
                        <div class="key-row">
                            <div class="key-icon-column">
                                <div class="key-avatar">
                                    <Key size={18} class="text-primary" />
                                </div>
                            </div>

                            <div class="key-info">
                                <div class="key-title-row">
                                    <h3>{key.title}</h3>
                                    <span class="key-fingerprint">{key.fingerprint}</span>
                                </div>

                                <div class="key-meta">
                                    <span class="meta-item">
                                        <Key size={12} />
                                        {key.keyType}
                                    </span>
                                    <span class="meta-divider">•</span>
                                    <span class="meta-item">
                                        <Clock size={12} />
                                        Added {formatTime(key.createdAt)}
                                    </span>
                                    <span class="meta-divider">•</span>
                                    <span class="meta-item" classList={{ 'text-green': !!key.lastUsed }}>
                                        <CheckCircle2 size={12} />
                                        Last used: {formatTime(key.lastUsed)}
                                    </span>
                                </div>
                            </div>

                            <div class="key-actions">
                                <button class="danger-btn" onClick={() => void handleDelete(key.id)} title="Delete key" disabled={isSaving()}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
}
