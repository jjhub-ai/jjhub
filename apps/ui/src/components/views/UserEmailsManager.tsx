import { createSignal, For, onMount, Show } from "solid-js";
import { CheckCircle2, Mail, Plus, Send, Trash2, Star } from "lucide-solid";
import { withAuthHeaders } from "../../lib/repoContext";
import "./FeatureSurface.css";
import { formatDateTime, readErrorMessage } from "./viewSupport";

type UserEmail = {
    id: number;
    email: string;
    is_activated: boolean;
    is_primary: boolean;
    created_at: string;
};

export default function UserEmailsManager() {
    const [emails, setEmails] = createSignal<UserEmail[]>([]);
    const [isLoading, setIsLoading] = createSignal(true);
    const [isSaving, setIsSaving] = createSignal(false);
    const [isAdding, setIsAdding] = createSignal(false);
    const [newEmail, setNewEmail] = createSignal("");
    const [newPrimary, setNewPrimary] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [notice, setNotice] = createSignal<string | null>(null);

    const loadEmails = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const response = await fetch("/api/user/emails", {
                credentials: "include",
                headers: withAuthHeaders(),
            });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, "Failed to load email addresses"));
            }
            const payload = (await response.json()) as UserEmail[];
            setEmails(Array.isArray(payload) ? payload : []);
        } catch (error) {
            setEmails([]);
            setErrorMessage(error instanceof Error ? error.message : "Failed to load email addresses");
        } finally {
            setIsLoading(false);
        }
    };

    onMount(() => {
        void loadEmails();
    });

    const resetForm = () => {
        setIsAdding(false);
        setNewEmail("");
        setNewPrimary(false);
    };

    const addEmail = async (event: Event) => {
        event.preventDefault();
        if (!newEmail().trim()) {
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);
        setNotice(null);
        try {
            const response = await fetch("/api/user/emails", {
                method: "POST",
                credentials: "include",
                headers: withAuthHeaders({
                    "Content-Type": "application/json",
                }),
                body: JSON.stringify({
                    email: newEmail().trim(),
                    is_primary: newPrimary(),
                }),
            });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, "Failed to add email address"));
            }
            const created = (await response.json()) as UserEmail;
            setEmails((current) => [created, ...current.filter((entry) => entry.id !== created.id)]);
            setNotice(`Added ${created.email}.`);
            resetForm();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to add email address");
        } finally {
            setIsSaving(false);
        }
    };

    const deleteEmail = async (email: UserEmail) => {
        if (!confirm(`Remove ${email.email} from this account?`)) {
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);
        setNotice(null);
        try {
            const response = await fetch(`/api/user/emails/${email.id}`, {
                method: "DELETE",
                credentials: "include",
                headers: withAuthHeaders(),
            });
            if (!response.ok && response.status !== 204) {
                throw new Error(await readErrorMessage(response, "Failed to delete email address"));
            }
            setEmails((current) => current.filter((entry) => entry.id !== email.id));
            setNotice(`Removed ${email.email}.`);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to delete email address");
        } finally {
            setIsSaving(false);
        }
    };

    const requestVerification = async (email: UserEmail) => {
        setIsSaving(true);
        setErrorMessage(null);
        setNotice(null);
        try {
            const response = await fetch(`/api/user/emails/${email.id}/verify`, {
                method: "POST",
                credentials: "include",
                headers: withAuthHeaders(),
            });
            if (!response.ok && response.status !== 204) {
                throw new Error(await readErrorMessage(response, "Failed to send verification email"));
            }
            setNotice(`Verification email sent to ${email.email}.`);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to send verification email");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div class="surface-page">
            <header class="surface-header">
                <div>
                    <h1>Email Addresses</h1>
                    <p>Add delivery addresses, resend verification, and remove stale contact points.</p>
                </div>
                <div class="surface-actions">
                    <Show when={!isAdding()}>
                        <button class="primary-btn" onClick={() => setIsAdding(true)}>
                            <Plus size={16} />
                            Add Email
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
                <form class="surface-card surface-form" onSubmit={addEmail}>
                    <div class="surface-card-header">
                        <div>
                            <h2>Add an email address</h2>
                            <p>New addresses start unverified until the recipient confirms them.</p>
                        </div>
                        <Mail size={20} class="text-muted" />
                    </div>

                    <div class="surface-inline-fields">
                        <div class="surface-field">
                            <label for="user-email-address">Email address</label>
                            <input
                                id="user-email-address"
                                type="email"
                                value={newEmail()}
                                onInput={(event) => setNewEmail(event.currentTarget.value)}
                                placeholder="name@example.com"
                                autofocus
                                required
                            />
                        </div>
                    </div>

                    <label class="surface-checkbox">
                        <input
                            type="checkbox"
                            checked={newPrimary()}
                            onChange={(event) => setNewPrimary(event.currentTarget.checked)}
                        />
                        <div>
                            <strong>Set as primary</strong>
                            <p>Use this address for future notifications and verification flows.</p>
                        </div>
                    </label>

                    <div class="surface-form-actions">
                        <button type="button" class="secondary-btn" onClick={resetForm} disabled={isSaving()}>
                            Cancel
                        </button>
                        <button type="submit" class="primary-btn" disabled={isSaving() || !newEmail().trim()}>
                            {isSaving() ? "Adding..." : "Add Email"}
                        </button>
                    </div>
                </form>
            </Show>

            <Show when={isLoading()}>
                <div class="surface-empty">
                    <h3>Loading email addresses...</h3>
                </div>
            </Show>

            <Show when={!isLoading() && emails().length === 0}>
                <div class="surface-empty">
                    <Mail size={32} />
                    <h3>No email addresses</h3>
                    <p>Add an address to receive JJHub notifications and verification links.</p>
                </div>
            </Show>

            <Show when={!isLoading() && emails().length > 0}>
                <div class="surface-list">
                    <For each={emails()}>
                        {(email) => (
                            <div class="surface-row">
                                <div class="surface-row-main">
                                    <div class="surface-row-title">
                                        <h3>{email.email}</h3>
                                        <Show when={email.is_primary}>
                                            <span class="surface-tag">
                                                <Star size={12} />
                                                Primary
                                            </span>
                                        </Show>
                                        <Show when={email.is_activated} fallback={<span class="surface-tag">Unverified</span>}>
                                            <span class="surface-tag">
                                                <CheckCircle2 size={12} />
                                                Verified
                                            </span>
                                        </Show>
                                    </div>
                                    <div class="surface-meta">
                                        <span>Added {formatDateTime(email.created_at)}</span>
                                    </div>
                                </div>
                                <div class="surface-row-actions">
                                    <Show when={!email.is_activated}>
                                        <button
                                            class="secondary-btn"
                                            disabled={isSaving()}
                                            onClick={() => void requestVerification(email)}
                                        >
                                            <Send size={14} />
                                            Send verification
                                        </button>
                                    </Show>
                                    <button class="danger-btn" disabled={isSaving()} onClick={() => void deleteEmail(email)} title="Delete email">
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
