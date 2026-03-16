import { createSignal, For, Show, onMount } from "solid-js";
import { withAuthHeaders } from "../../lib/repoContext";

type WhitelistEntry = {
    id: number;
    identity_type: string;
    identity_value: string;
    created_at: string;
};

type WaitlistEntry = {
    id: number;
    email: string;
    status: string;
    source: string;
    created_at: string;
};

type WaitlistPage = {
    items: WaitlistEntry[];
    total_count: number;
    page: number;
    per_page: number;
};

export default function ClosedBetaAccessView() {
    const [whitelist, setWhitelist] = createSignal<WhitelistEntry[]>([]);
    const [waitlist, setWaitlist] = createSignal<WaitlistEntry[]>([]);
    const [isLoading, setIsLoading] = createSignal(true);
    const [error, setError] = createSignal<string | null>(null);
    const [nonAdmin, setNonAdmin] = createSignal(false);
    const [identityType, setIdentityType] = createSignal("email");
    const [identityValue, setIdentityValue] = createSignal("");
    const [isSaving, setIsSaving] = createSignal(false);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        setNonAdmin(false);
        try {
            const [whitelistRes, waitlistRes] = await Promise.all([
                fetch("/api/admin/alpha/whitelist", {
                    credentials: "include",
                    headers: withAuthHeaders(),
                }),
                fetch("/api/admin/alpha/waitlist?status=pending&per_page=100", {
                    credentials: "include",
                    headers: withAuthHeaders(),
                }),
            ]);

            if (whitelistRes.status === 401 || whitelistRes.status === 403) {
                setNonAdmin(true);
                setWhitelist([]);
                setWaitlist([]);
                return;
            }
            if (!whitelistRes.ok) {
                throw new Error(`Failed to load whitelist (${whitelistRes.status})`);
            }
            if (!waitlistRes.ok) {
                throw new Error(`Failed to load waitlist (${waitlistRes.status})`);
            }

            const whitelistBody = (await whitelistRes.json()) as WhitelistEntry[];
            const waitlistBody = (await waitlistRes.json()) as WaitlistPage;
            setWhitelist(Array.isArray(whitelistBody) ? whitelistBody : []);
            setWaitlist(waitlistBody.items ?? []);
        } catch (loadErr) {
            const message = loadErr instanceof Error ? loadErr.message : "Failed to load closed alpha data";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    onMount(() => {
        void loadData();
    });

    const addWhitelistEntry = async () => {
        if (!identityValue().trim()) {
            setError("Identity value is required.");
            return;
        }
        setIsSaving(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/alpha/whitelist", {
                method: "POST",
                credentials: "include",
                headers: withAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({
                    identity_type: identityType(),
                    identity_value: identityValue().trim(),
                }),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.message ?? `Failed to add whitelist entry (${response.status})`);
            }
            setIdentityValue("");
            await loadData();
        } catch (saveErr) {
            const message = saveErr instanceof Error ? saveErr.message : "Failed to add whitelist entry";
            setError(message);
        } finally {
            setIsSaving(false);
        }
    };

    const removeWhitelistEntry = async (entry: WhitelistEntry) => {
        setIsSaving(true);
        setError(null);
        try {
            const response = await fetch(
                `/api/admin/alpha/whitelist/${encodeURIComponent(entry.identity_type)}/${encodeURIComponent(entry.identity_value)}`,
                {
                    method: "DELETE",
                    credentials: "include",
                    headers: withAuthHeaders(),
                }
            );
            if (!response.ok && response.status !== 404) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.message ?? `Failed to remove whitelist entry (${response.status})`);
            }
            await loadData();
        } catch (removeErr) {
            const message = removeErr instanceof Error ? removeErr.message : "Failed to remove whitelist entry";
            setError(message);
        } finally {
            setIsSaving(false);
        }
    };

    const approveWaitlistEntry = async (entry: WaitlistEntry) => {
        setIsSaving(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/alpha/waitlist/approve", {
                method: "POST",
                credentials: "include",
                headers: withAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ email: entry.email }),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.message ?? `Failed to approve waitlist entry (${response.status})`);
            }
            await loadData();
        } catch (approveErr) {
            const message = approveErr instanceof Error ? approveErr.message : "Failed to approve waitlist entry";
            setError(message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div class="settings-page p-8 max-w-5xl mx-auto w-full">
            <header class="mb-6">
                <h1 class="text-2xl font-semibold text-primary">Closed Alpha Access</h1>
                <p class="text-muted mt-2">Manage whitelist access and process waitlist requests.</p>
            </header>

            <Show when={error()}>
                {(message) => <p class="text-red mb-4">{message()}</p>}
            </Show>

            <Show when={nonAdmin()}>
                <div class="border border-yellow/40 bg-yellow/10 rounded-lg p-4 text-yellow">
                    Admin access is required to manage closed alpha entries.
                </div>
            </Show>

            <Show when={!nonAdmin()}>
                <div class="grid gap-6">
                    <section class="bg-panel border border-color rounded-xl p-5">
                        <h2 class="text-lg font-medium mb-4">Add Whitelist Entry</h2>
                        <div class="flex flex-wrap gap-3 items-center">
                            <select
                                value={identityType()}
                                onChange={(event) => setIdentityType(event.currentTarget.value)}
                                class="bg-app border border-color rounded px-3 py-2"
                            >
                                <option value="email">email</option>
                                <option value="wallet">wallet</option>
                                <option value="username">username</option>
                            </select>
                            <input
                                type="text"
                                value={identityValue()}
                                onInput={(event) => setIdentityValue(event.currentTarget.value)}
                                placeholder="Identity value"
                                class="flex-1 min-w-64 bg-app border border-color rounded px-3 py-2"
                            />
                            <button class="btn btn-primary" onClick={addWhitelistEntry} disabled={isSaving()}>
                                Add
                            </button>
                        </div>
                    </section>

                    <section class="bg-panel border border-color rounded-xl p-5">
                        <h2 class="text-lg font-medium mb-4">Whitelist</h2>
                        <Show when={!isLoading()} fallback={<p class="text-muted">Loading whitelist...</p>}>
                            <Show when={whitelist().length > 0} fallback={<p class="text-muted">No whitelist entries yet.</p>}>
                                <div class="flex flex-col gap-3">
                                    <For each={whitelist()}>
                                        {(entry) => (
                                            <div class="flex items-center justify-between border border-color rounded px-3 py-2">
                                                <div class="text-sm">
                                                    <span class="font-medium">{entry.identity_type}</span>
                                                    <span class="text-muted mx-2">•</span>
                                                    <span>{entry.identity_value}</span>
                                                </div>
                                                <button
                                                    class="btn btn-sm btn-danger"
                                                    onClick={() => void removeWhitelistEntry(entry)}
                                                    disabled={isSaving()}
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </Show>
                        </Show>
                    </section>

                    <section class="bg-panel border border-color rounded-xl p-5">
                        <h2 class="text-lg font-medium mb-4">Pending Waitlist</h2>
                        <Show when={!isLoading()} fallback={<p class="text-muted">Loading waitlist...</p>}>
                            <Show when={waitlist().length > 0} fallback={<p class="text-muted">No pending waitlist entries.</p>}>
                                <div class="flex flex-col gap-3">
                                    <For each={waitlist()}>
                                        {(entry) => (
                                            <div class="flex items-center justify-between border border-color rounded px-3 py-2">
                                                <div class="text-sm">
                                                    <span class="font-medium">{entry.email}</span>
                                                    <span class="text-muted mx-2">•</span>
                                                    <span class="text-muted">{entry.source}</span>
                                                </div>
                                                <button
                                                    class="btn btn-sm btn-primary"
                                                    onClick={() => void approveWaitlistEntry(entry)}
                                                    disabled={isSaving()}
                                                >
                                                    Approve
                                                </button>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </Show>
                        </Show>
                    </section>
                </div>
            </Show>
        </div>
    );
}
