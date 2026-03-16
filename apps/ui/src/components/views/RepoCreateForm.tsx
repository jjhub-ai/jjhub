import { createSignal, onMount, Show, For, createResource } from "solid-js";
import { A } from "@solidjs/router";
import { useNavigate } from "@solidjs/router";
import { CopyPlus, FileText, Globe, Lock, ShieldAlert, Database, GitBranch, Download, BookOpen, User, Building2 } from "lucide-solid";
import { apiFetch, withAuthHeaders } from "../../lib/repoContext";
import "./RepoCreateForm.css";

type OrgSummary = {
    id: number;
    name: string;
    description: string;
};

type UserProfile = {
    id: number;
    username: string;
    display_name: string;
};

/** Validate repo name: lowercase alphanumeric, hyphens, underscores, dots. Must start with alphanumeric. */
function validateRepoName(name: string): string | null {
    if (!name) return "Repository name is required.";
    if (!/^[a-zA-Z0-9]/.test(name)) return "Name must start with a letter or number.";
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) return "Name may only contain letters, numbers, hyphens, underscores, and dots.";
    if (name.length > 100) return "Name must be 100 characters or fewer.";
    return null;
}

async function fetchCurrentUser(): Promise<UserProfile | null> {
    try {
        const res = await apiFetch("/api/user");
        if (!res.ok) return null;
        return (await res.json()) as UserProfile;
    } catch {
        return null;
    }
}

async function fetchUserOrgs(): Promise<OrgSummary[]> {
    try {
        const res = await apiFetch("/api/user/orgs");
        if (!res.ok) return [];
        return (await res.json()) as OrgSummary[];
    } catch {
        return [];
    }
}

export default function RepoCreateForm() {
    const navigate = useNavigate();
    const [isHydrated, setIsHydrated] = createSignal(false);
    const [activeTab, setActiveTab] = createSignal<"create" | "import">("create");
    const [isSubmitting, setIsSubmitting] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [successMessage, setSuccessMessage] = createSignal<string | null>(null);

    // Create form state
    const [repoName, setRepoName] = createSignal("");
    const [nameError, setNameError] = createSignal<string | null>(null);
    const [description, setDescription] = createSignal("");
    const [isPrivate, setIsPrivate] = createSignal(true);
    const [defaultBookmark, setDefaultBookmark] = createSignal("main");
    const [autoInit, setAutoInit] = createSignal(true);
    const [selectedOwner, setSelectedOwner] = createSignal<string>(""); // "" means personal (user)

    // Import form state
    const [importUrl, setImportUrl] = createSignal("");
    const [importRepoName, setImportRepoName] = createSignal("");
    const [importIsPrivate, setImportIsPrivate] = createSignal(true);

    // Fetch current user and orgs
    const [currentUser] = createResource(fetchCurrentUser);
    const [userOrgs] = createResource(fetchUserOrgs);

    const handleRepoNameInput = (value: string) => {
        setRepoName(value);
        if (value.trim()) {
            setNameError(validateRepoName(value.trim()));
        } else {
            setNameError(null);
        }
    };

    const effectiveOwner = () => {
        const selected = selectedOwner();
        if (selected) return selected;
        return currentUser()?.username ?? "";
    };

    const handleCreateSubmit = async (e: Event) => {
        e.preventDefault();
        const trimmedName = repoName().trim();

        // Validate name
        const validationError = validateRepoName(trimmedName);
        if (validationError) {
            setNameError(validationError);
            return;
        }

        const trimmedDescription = description().trim();
        const trimmedBookmark = defaultBookmark().trim() || "main";
        const owner = effectiveOwner();
        const isOrgRepo = selectedOwner() !== "";

        setIsSubmitting(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            // Determine endpoint: personal vs org
            const endpoint = isOrgRepo
                ? `/api/orgs/${encodeURIComponent(selectedOwner())}/repos`
                : "/api/user/repos";

            const response = await fetch(endpoint, {
                method: "POST",
                credentials: "include",
                headers: withAuthHeaders({
                    "Content-Type": "application/json",
                }),
                body: JSON.stringify({
                    name: trimmedName,
                    description: trimmedDescription,
                    private: isPrivate(),
                    auto_init: autoInit(),
                    default_bookmark: trimmedBookmark,
                }),
            });

            if (!response.ok) {
                const body = await response.json().catch(() => null);
                const apiMessage = (body as { message?: string })?.message;
                throw new Error(apiMessage ?? `Failed to create repository (${response.status})`);
            }

            const created = (await response.json()) as {
                full_name?: string;
                name?: string;
                owner?: string;
                default_bookmark?: string;
            };

            // Navigate to the new repo
            const repoOwner = created.owner ?? owner;
            const repoNameStr = created.name ?? trimmedName;
            navigate(`/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoNameStr)}/code`);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to create repository";
            setErrorMessage(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleImportSubmit = (e: Event) => {
        e.preventDefault();
        // Import/mirror API does not exist yet
        setErrorMessage(null);
    };

    onMount(() => {
        setIsHydrated(true);
    });

    return (
        <div class="repo-create-container" data-hydrated={isHydrated() ? "true" : "false"}>
            <header class="create-header animate-in stagger-1">
                <div class="header-icon-wrapper">
                    <Database size={24} class="text-blue" />
                </div>
                <div class="header-text">
                    <h1>Add Repository</h1>
                    <p class="text-muted">Create a new jj repository or import an existing one.</p>
                </div>
            </header>

            <Show when={errorMessage()}>
                {(message) => (
                    <div class="error-banner animate-in">
                        <ShieldAlert size={16} class="text-red flex-shrink-0" />
                        <p class="text-red text-sm">{message()}</p>
                    </div>
                )}
            </Show>
            <Show when={successMessage()}>
                {(message) => <p class="text-green mb-4">{message()}</p>}
            </Show>

            <div class="create-tabs animate-in stagger-2">
                <button
                    class={`tab-btn ${activeTab() === "create" ? "active" : ""}`}
                    onClick={() => { setActiveTab("create"); setErrorMessage(null); }}
                >
                    <CopyPlus size={16} />
                    New Repository
                </button>
                <button
                    class={`tab-btn ${activeTab() === "import" ? "active" : ""}`}
                    onClick={() => { setActiveTab("import"); setErrorMessage(null); }}
                >
                    <Download size={16} />
                    Import Repository
                </button>
            </div>

            <div class="form-card animate-in stagger-3">
                <Show when={activeTab() === "create"}>
                    <form class="repo-form" onSubmit={(e) => void handleCreateSubmit(e)}>
                        {/* Owner selector */}
                        <div class="form-group">
                            <label for="owner">Owner</label>
                            <div class="owner-select-wrapper">
                                <select
                                    id="owner"
                                    class="owner-select"
                                    value={selectedOwner()}
                                    onChange={(e) => setSelectedOwner(e.currentTarget.value)}
                                >
                                    <option value="">
                                        {currentUser()?.username ?? "Personal account"}
                                    </option>
                                    <For each={userOrgs() ?? []}>
                                        {(org) => (
                                            <option value={org.name}>{org.name}</option>
                                        )}
                                    </For>
                                </select>
                                <span class="owner-select-icon">
                                    <Show when={selectedOwner()} fallback={<User size={16} />}>
                                        <Building2 size={16} />
                                    </Show>
                                </span>
                            </div>
                            <p class="input-hint">
                                Create under <strong>{effectiveOwner() || "your account"}</strong>
                                {selectedOwner() ? " (organization)" : " (personal)"}
                            </p>
                        </div>

                        {/* Repository name */}
                        <div class="form-group">
                            <label for="repoName">Repository Name</label>
                            <input
                                type="text"
                                id="repoName"
                                name="repo_name"
                                placeholder="e.g. backend-services"
                                value={repoName()}
                                onInput={(e) => handleRepoNameInput(e.currentTarget.value)}
                                autocomplete="off"
                                autofocus
                                required
                                class={nameError() ? "input-error" : ""}
                            />
                            <Show when={nameError()}>
                                {(err) => <p class="field-error">{err()}</p>}
                            </Show>
                            <Show when={!nameError()}>
                                <p class="input-hint">Great repository names are short and memorable.</p>
                            </Show>
                        </div>

                        {/* Description */}
                        <div class="form-group">
                            <label for="description">Description <span class="text-muted font-normal text-xs ml-1">(Optional)</span></label>
                            <div class="input-icon-wrapper">
                                <FileText size={16} class="input-icon text-muted" />
                                <input
                                    type="text"
                                    id="description"
                                    name="repo_description"
                                    placeholder="Brief description of this repository"
                                    value={description()}
                                    onInput={(e) => setDescription(e.currentTarget.value)}
                                    autocomplete="off"
                                />
                            </div>
                        </div>

                        {/* Visibility */}
                        <div class="visibility-section">
                            <label class="section-label">Visibility</label>
                            <div class="visibility-options">
                                <label class={`vis-card ${isPrivate() ? "selected" : ""}`}>
                                    <input
                                        type="radio"
                                        name="visibility"
                                        checked={isPrivate()}
                                        onChange={() => setIsPrivate(true)}
                                    />
                                    <div class="vis-icon text-red">
                                        <Lock size={20} />
                                    </div>
                                    <div class="vis-content">
                                        <span class="vis-title">Private</span>
                                        <span class="vis-desc text-muted">You choose who can see and commit to this repository.</span>
                                    </div>
                                    <div class="radio-indicator"></div>
                                </label>

                                <label class={`vis-card ${!isPrivate() ? "selected" : ""}`}>
                                    <input
                                        type="radio"
                                        name="visibility"
                                        checked={!isPrivate()}
                                        onChange={() => setIsPrivate(false)}
                                    />
                                    <div class="vis-icon text-green">
                                        <Globe size={20} />
                                    </div>
                                    <div class="vis-content">
                                        <span class="vis-title">Public</span>
                                        <span class="vis-desc text-muted">Anyone on the internet can see this repository.</span>
                                    </div>
                                    <div class="radio-indicator"></div>
                                </label>
                            </div>
                        </div>

                        {/* Default bookmark */}
                        <div class="form-group">
                            <label for="defaultBookmark">Default Bookmark</label>
                            <div class="input-icon-wrapper">
                                <GitBranch size={16} class="input-icon text-muted" />
                                <input
                                    type="text"
                                    id="defaultBookmark"
                                    placeholder="main"
                                    value={defaultBookmark()}
                                    onInput={(e) => setDefaultBookmark(e.currentTarget.value)}
                                    autocomplete="off"
                                />
                            </div>
                            <p class="input-hint">The primary bookmark for this repository. Defaults to "main".</p>
                        </div>

                        {/* Auto-init */}
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={autoInit()}
                                    onChange={(e) => setAutoInit(e.currentTarget.checked)}
                                />
                                <BookOpen size={16} class="text-muted" />
                                <span>Initialize this repository with a README</span>
                            </label>
                            <p class="input-hint checkbox-hint">This creates an initial commit so you can start working immediately.</p>
                        </div>

                        <div class="form-warning">
                            <ShieldAlert size={16} class="text-yellow flex-shrink-0 mt-0.5" />
                            <p class="text-sm">
                                This will initialize a new Jujutsu (<code class="bg-black/50 px-1 rounded text-yellow text-xs">jj</code>) workspace configured for JJHub.
                                The <code class="bg-black/50 px-1 rounded text-yellow text-xs">{defaultBookmark() || "main"}</code> bookmark will be tracked.
                            </p>
                        </div>

                        <div class="form-actions">
                            <button type="button" class="secondary-btn" onClick={() => window.history.back()}>Cancel</button>
                            <button
                                type="submit"
                                class="primary-btn submit-btn"
                                disabled={isSubmitting() || !!nameError()}
                            >
                                {isSubmitting() ? "Creating..." : "Create Repository"}
                            </button>
                        </div>
                    </form>
                </Show>

                <Show when={activeTab() === "import"}>
                    <form class="repo-form" onSubmit={handleImportSubmit}>
                        <div class="import-coming-soon">
                            <div class="coming-soon-icon">
                                <Download size={32} class="text-muted" />
                            </div>
                            <h3>Mirror-first import workflow</h3>
                            <p class="text-muted text-sm">
                                Use the GitHub Mirror integration for a Gitea-style mirror while direct repository migration is still being wired into the create flow.
                            </p>
                            <p class="text-muted text-sm">
                                Create the destination repository on GitHub before you enable the mirror worker.
                            </p>
                            <p class="text-sm">
                                <A href="/integrations/github" class="text-primary hover:underline">
                                    Open GitHub Mirror setup
                                </A>
                            </p>
                        </div>

                        <div class="form-group">
                            <label for="importUrl">Repository URL</label>
                            <div class="input-icon-wrapper">
                                <Globe size={16} class="input-icon text-muted" />
                                <input
                                    type="text"
                                    id="importUrl"
                                    placeholder="e.g. https://github.com/owner/repo.git"
                                    value={importUrl()}
                                    onInput={(e) => setImportUrl(e.currentTarget.value)}
                                    autocomplete="off"
                                    disabled
                                />
                            </div>
                            <p class="input-hint">Enter the full Git URL of the repository to import.</p>
                        </div>

                        <div class="form-group">
                            <label for="importRepoName">Repository Name <span class="text-muted font-normal text-xs ml-1">(Optional)</span></label>
                            <input
                                type="text"
                                id="importRepoName"
                                placeholder="Defaults to the source repository name"
                                value={importRepoName()}
                                onInput={(e) => setImportRepoName(e.currentTarget.value)}
                                autocomplete="off"
                                disabled
                            />
                        </div>

                        <div class="visibility-section">
                            <label class="section-label">Visibility</label>
                            <div class="visibility-options">
                                <label class={`vis-card disabled ${importIsPrivate() ? "selected" : ""}`}>
                                    <input type="radio" name="import_visibility" checked={importIsPrivate()} disabled />
                                    <div class="vis-icon text-red"><Lock size={20} /></div>
                                    <div class="vis-content">
                                        <span class="vis-title">Private</span>
                                        <span class="vis-desc text-muted">You choose who can see and commit to this repository.</span>
                                    </div>
                                    <div class="radio-indicator"></div>
                                </label>
                                <label class={`vis-card disabled ${!importIsPrivate() ? "selected" : ""}`}>
                                    <input type="radio" name="import_visibility" checked={!importIsPrivate()} disabled />
                                    <div class="vis-icon text-green"><Globe size={20} /></div>
                                    <div class="vis-content">
                                        <span class="vis-title">Public</span>
                                        <span class="vis-desc text-muted">Anyone on the internet can see this repository.</span>
                                    </div>
                                    <div class="radio-indicator"></div>
                                </label>
                            </div>
                        </div>

                        <div class="form-actions">
                            <button type="button" class="secondary-btn" onClick={() => window.history.back()}>Cancel</button>
                            <button type="submit" class="primary-btn submit-btn" disabled>
                                Import Repository
                            </button>
                        </div>
                    </form>
                </Show>
            </div>
        </div>
    );
}
