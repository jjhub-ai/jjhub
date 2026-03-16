import { createSignal, For, onMount, Show } from "solid-js";
import { AlertTriangle, CheckCircle2, Copy, Globe, Plus, Shield, Trash2 } from "lucide-solid";
import { withAuthHeaders } from "../../lib/repoContext";
import "./FeatureSurface.css";
import { formatDateTime, readErrorMessage, splitLines } from "./viewSupport";

type OAuthApplication = {
    id: number;
    client_id: string;
    name: string;
    redirect_uris: string[];
    scopes: string[];
    confidential: boolean;
    created_at: string;
    updated_at: string;
};

type CreatedOAuthApplication = OAuthApplication & {
    client_secret: string;
};

const AVAILABLE_SCOPES = [
    { id: "read:repository", label: "Read Repository" },
    { id: "write:repository", label: "Write Repository" },
    { id: "read:user", label: "Read User" },
    { id: "write:user", label: "Write User" },
    { id: "admin", label: "Admin" },
];

export default function OAuthApplicationsView() {
    const [applications, setApplications] = createSignal<OAuthApplication[]>([]);
    const [isLoading, setIsLoading] = createSignal(true);
    const [isSaving, setIsSaving] = createSignal(false);
    const [isCreating, setIsCreating] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [notice, setNotice] = createSignal<string | null>(null);
    const [copiedSecret, setCopiedSecret] = createSignal(false);

    const [name, setName] = createSignal("");
    const [redirectUris, setRedirectUris] = createSignal("");
    const [selectedScopes, setSelectedScopes] = createSignal<string[]>(["read:user"]);
    const [confidential, setConfidential] = createSignal(true);
    const [createdApp, setCreatedApp] = createSignal<CreatedOAuthApplication | null>(null);

    const loadApplications = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const response = await fetch("/api/oauth2/applications", {
                credentials: "include",
                headers: withAuthHeaders(),
            });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, "Failed to load OAuth applications"));
            }
            const payload = (await response.json()) as OAuthApplication[];
            setApplications(Array.isArray(payload) ? payload : []);
        } catch (error) {
            setApplications([]);
            setErrorMessage(error instanceof Error ? error.message : "Failed to load OAuth applications");
        } finally {
            setIsLoading(false);
        }
    };

    onMount(() => {
        void loadApplications();
    });

    const toggleScope = (scope: string) => {
        setSelectedScopes((current) =>
            current.includes(scope)
                ? current.filter((value) => value !== scope)
                : [...current, scope]
        );
    };

    const resetForm = () => {
        setIsCreating(false);
        setName("");
        setRedirectUris("");
        setSelectedScopes(["read:user"]);
        setConfidential(true);
        setCreatedApp(null);
        setCopiedSecret(false);
    };

    const createApplication = async (event: Event) => {
        event.preventDefault();
        const redirectUriList = splitLines(redirectUris());
        if (!name().trim() || redirectUriList.length === 0) {
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);
        setNotice(null);
        try {
            const response = await fetch("/api/oauth2/applications", {
                method: "POST",
                credentials: "include",
                headers: withAuthHeaders({
                    "Content-Type": "application/json",
                }),
                body: JSON.stringify({
                    name: name().trim(),
                    redirect_uris: redirectUriList,
                    scopes: selectedScopes(),
                    confidential: confidential(),
                }),
            });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, "Failed to create OAuth application"));
            }

            const created = (await response.json()) as CreatedOAuthApplication;
            setApplications((current) => [created, ...current.filter((entry) => entry.id !== created.id)]);
            setCreatedApp(created);
            setNotice(`Created OAuth application ${created.name}.`);
            setName("");
            setRedirectUris("");
            setSelectedScopes(["read:user"]);
            setConfidential(true);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to create OAuth application");
        } finally {
            setIsSaving(false);
        }
    };

    const deleteApplication = async (application: OAuthApplication) => {
        if (!confirm(`Delete OAuth application ${application.name}? Existing client credentials will stop working immediately.`)) {
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);
        setNotice(null);
        try {
            const response = await fetch(`/api/oauth2/applications/${application.id}`, {
                method: "DELETE",
                credentials: "include",
                headers: withAuthHeaders(),
            });
            if (!response.ok && response.status !== 204) {
                throw new Error(await readErrorMessage(response, "Failed to delete OAuth application"));
            }
            setApplications((current) => current.filter((entry) => entry.id !== application.id));
            setNotice(`Deleted ${application.name}.`);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to delete OAuth application");
        } finally {
            setIsSaving(false);
        }
    };

    const copySecret = async () => {
        const secret = createdApp()?.client_secret;
        if (!secret) {
            return;
        }
        await navigator.clipboard.writeText(secret);
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 2000);
    };

    return (
        <div class="surface-page">
            <header class="surface-header">
                <div>
                    <h1>OAuth Applications</h1>
                    <p>Register first-party clients, manage redirect URIs, and capture the client secret at creation time.</p>
                </div>
                <div class="surface-actions">
                    <Show when={!isCreating()}>
                        <button class="primary-btn" onClick={() => setIsCreating(true)}>
                            <Plus size={16} />
                            New Application
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

            <Show when={isCreating()}>
                <div class="surface-card">
                    <Show
                        when={createdApp()}
                        fallback={
                            <form class="surface-form" onSubmit={createApplication}>
                                <div class="surface-card-header">
                                    <div>
                                        <h2>Create OAuth application</h2>
                                        <p>Redirect URIs can be separated by newlines or commas.</p>
                                    </div>
                                    <Shield size={20} class="text-muted" />
                                </div>

                                <div class="surface-inline-fields">
                                    <div class="surface-field">
                                        <label for="oauth-app-name">Application name</label>
                                        <input
                                            id="oauth-app-name"
                                            type="text"
                                            value={name()}
                                            onInput={(event) => setName(event.currentTarget.value)}
                                            placeholder="Desktop CLI"
                                            autofocus
                                            required
                                        />
                                    </div>
                                </div>

                                <div class="surface-field">
                                    <label for="oauth-redirect-uris">Redirect URIs</label>
                                    <textarea
                                        id="oauth-redirect-uris"
                                        value={redirectUris()}
                                        onInput={(event) => setRedirectUris(event.currentTarget.value)}
                                        placeholder="http://localhost:4000/callback"
                                        required
                                    />
                                </div>

                                <div class="surface-field">
                                    <label>Scopes</label>
                                    <div class="surface-tags">
                                        <For each={AVAILABLE_SCOPES}>
                                            {(scope) => (
                                                <label class="surface-tag">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedScopes().includes(scope.id)}
                                                        onChange={() => toggleScope(scope.id)}
                                                    />
                                                    {scope.label}
                                                </label>
                                            )}
                                        </For>
                                    </div>
                                </div>

                                <label class="surface-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={confidential()}
                                        onChange={(event) => setConfidential(event.currentTarget.checked)}
                                    />
                                    <div>
                                        <strong>Confidential client</strong>
                                        <p>Use a client secret for server-side or trusted applications.</p>
                                    </div>
                                </label>

                                <div class="surface-form-actions">
                                    <button type="button" class="secondary-btn" onClick={resetForm} disabled={isSaving()}>
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        class="primary-btn"
                                        disabled={isSaving() || !name().trim() || splitLines(redirectUris()).length === 0}
                                    >
                                        {isSaving() ? "Creating..." : "Create Application"}
                                    </button>
                                </div>
                            </form>
                        }
                    >
                        {(application) => (
                            <div class="surface-stack">
                                <div class="surface-banner warning">
                                    <div style={{ display: "flex", "align-items": "center", gap: "0.65rem" }}>
                                        <AlertTriangle size={18} />
                                        <strong>Copy the client secret now.</strong>
                                    </div>
                                    <div style={{ "margin-top": "0.45rem" }}>
                                        JJHub will only show the plaintext secret once.
                                    </div>
                                </div>
                                <div class="surface-row">
                                    <div class="surface-row-main">
                                        <div class="surface-row-title">
                                            <h3>{application().name}</h3>
                                        </div>
                                        <div class="surface-meta">
                                            <span>Client ID</span>
                                            <span class="surface-code">{application().client_id}</span>
                                        </div>
                                        <div class="surface-meta">
                                            <span>Client Secret</span>
                                            <span class="surface-code">{application().client_secret}</span>
                                        </div>
                                    </div>
                                    <div class="surface-row-actions">
                                        <button class="secondary-btn" onClick={() => void copySecret()}>
                                            <Show when={copiedSecret()} fallback={<Copy size={14} />}>
                                                <CheckCircle2 size={14} />
                                            </Show>
                                            {copiedSecret() ? "Copied" : "Copy Secret"}
                                        </button>
                                        <button class="primary-btn" onClick={resetForm}>
                                            Done
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Show>
                </div>
            </Show>

            <Show when={isLoading()}>
                <div class="surface-empty">
                    <h3>Loading OAuth applications...</h3>
                </div>
            </Show>

            <Show when={!isLoading() && applications().length === 0}>
                <div class="surface-empty">
                    <Shield size={32} />
                    <h3>No OAuth applications</h3>
                    <p>Create one to test authorization-code, PKCE, or server-to-server flows against JJHub.</p>
                </div>
            </Show>

            <Show when={!isLoading() && applications().length > 0}>
                <div class="surface-list">
                    <For each={applications()}>
                        {(application) => (
                            <div class="surface-row">
                                <div class="surface-row-main">
                                    <div class="surface-row-title">
                                        <h3>{application.name}</h3>
                                        <span class="surface-tag">
                                            <Shield size={12} />
                                            {application.confidential ? "Confidential" : "Public"}
                                        </span>
                                    </div>
                                    <div class="surface-meta">
                                        <span class="surface-code">{application.client_id}</span>
                                        <span>Created {formatDateTime(application.created_at)}</span>
                                        <span>Updated {formatDateTime(application.updated_at)}</span>
                                    </div>
                                    <Show when={application.redirect_uris.length > 0}>
                                        <div class="surface-tags">
                                            <For each={application.redirect_uris}>
                                                {(uri) => (
                                                    <span class="surface-tag">
                                                        <Globe size={12} />
                                                        {uri}
                                                    </span>
                                                )}
                                            </For>
                                        </div>
                                    </Show>
                                    <Show when={application.scopes.length > 0}>
                                        <div class="surface-tags">
                                            <For each={application.scopes}>
                                                {(scope) => <span class="surface-tag">{scope}</span>}
                                            </For>
                                        </div>
                                    </Show>
                                </div>
                                <div class="surface-row-actions">
                                    <button class="danger-btn" disabled={isSaving()} onClick={() => void deleteApplication(application)} title="Delete application">
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
