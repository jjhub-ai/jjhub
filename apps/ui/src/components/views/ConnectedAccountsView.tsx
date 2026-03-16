import { createSignal, For, onMount, Show } from "solid-js";
import { Link2, Trash2 } from "lucide-solid";
import { withAuthHeaders } from "../../lib/repoContext";
import "./FeatureSurface.css";
import { formatDateTime, readErrorMessage } from "./viewSupport";

type ConnectedAccount = {
    id: number;
    provider: string;
    provider_user_id: string;
    created_at: string;
    updated_at: string;
};

function providerLabel(provider: string): string {
    if (!provider) {
        return "Unknown";
    }
    return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export default function ConnectedAccountsView() {
    const [accounts, setAccounts] = createSignal<ConnectedAccount[]>([]);
    const [isLoading, setIsLoading] = createSignal(true);
    const [pendingId, setPendingId] = createSignal<number | null>(null);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [notice, setNotice] = createSignal<string | null>(null);

    const loadAccounts = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const response = await fetch("/api/user/connections", {
                credentials: "include",
                headers: withAuthHeaders(),
            });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, "Failed to load connected accounts"));
            }
            const payload = (await response.json()) as ConnectedAccount[];
            setAccounts(Array.isArray(payload) ? payload : []);
        } catch (error) {
            setAccounts([]);
            setErrorMessage(error instanceof Error ? error.message : "Failed to load connected accounts");
        } finally {
            setIsLoading(false);
        }
    };

    onMount(() => {
        void loadAccounts();
    });

    const handleDisconnect = async (account: ConnectedAccount) => {
        if (!confirm(`Disconnect ${providerLabel(account.provider)} account ${account.provider_user_id}?`)) {
            return;
        }

        setPendingId(account.id);
        setErrorMessage(null);
        setNotice(null);
        try {
            const response = await fetch(`/api/user/connections/${account.id}`, {
                method: "DELETE",
                credentials: "include",
                headers: withAuthHeaders(),
            });
            if (!response.ok && response.status !== 204) {
                throw new Error(await readErrorMessage(response, "Failed to disconnect account"));
            }
            setAccounts((current) => current.filter((entry) => entry.id !== account.id));
            setNotice(`${providerLabel(account.provider)} account disconnected.`);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to disconnect account");
        } finally {
            setPendingId(null);
        }
    };

    return (
        <div class="surface-page">
            <header class="surface-header">
                <div>
                    <h1>Connected Accounts</h1>
                    <p>Review third-party identities linked to this JJHub account and disconnect any you no longer trust.</p>
                </div>
            </header>

            <Show when={errorMessage()}>
                {(message) => <div class="surface-banner error">{message()}</div>}
            </Show>
            <Show when={notice()}>
                {(message) => <div class="surface-banner success">{message()}</div>}
            </Show>

            <Show when={isLoading()}>
                <div class="surface-empty">
                    <h3>Loading connected accounts...</h3>
                </div>
            </Show>

            <Show when={!isLoading() && accounts().length === 0}>
                <div class="surface-empty">
                    <Link2 size={32} />
                    <h3>No connected accounts</h3>
                    <p>Sign in with a provider to see linked identities here.</p>
                </div>
            </Show>

            <Show when={!isLoading() && accounts().length > 0}>
                <div class="surface-list">
                    <For each={accounts()}>
                        {(account) => (
                            <div class="surface-row">
                                <div class="surface-row-main">
                                    <div class="surface-row-title">
                                        <h3>{providerLabel(account.provider)}</h3>
                                        <span class="surface-tag">{account.provider_user_id}</span>
                                    </div>
                                    <div class="surface-meta">
                                        <span>Linked {formatDateTime(account.created_at)}</span>
                                        <span>Updated {formatDateTime(account.updated_at)}</span>
                                    </div>
                                </div>
                                <div class="surface-row-actions">
                                    <button
                                        class="danger-btn"
                                        disabled={pendingId() === account.id}
                                        onClick={() => void handleDisconnect(account)}
                                        title="Disconnect account"
                                    >
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
