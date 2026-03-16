import { useLocation } from "@solidjs/router";
import { Activity, Boxes, Building2, Cpu, HeartPulse, Plus, Shield, Trash2, UserCog, Users, Workflow } from "lucide-solid";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { withAuthHeaders } from "../../lib/repoContext";
import "./FeatureSurface.css";
import { daysAgoISOString, formatDateTime, readErrorMessage } from "./viewSupport";

type AdminSection = "overview" | "users" | "orgs" | "repos" | "runners" | "workflows" | "health";

type AdminUser = {
    id: number;
    username: string;
    display_name: string;
    email: string;
    is_admin: boolean;
    created_at: string;
    updated_at: string;
};

type AdminOrg = {
    id: number;
    name: string;
    description: string;
    visibility: string;
    website: string;
    location: string;
};

type AdminRepo = {
    id: number;
    name: string;
    description: string;
    is_public: boolean;
    is_archived: boolean;
    num_stars: number;
    num_issues: number;
    created_at: string;
    updated_at: string;
};

type AdminRunner = {
    id: number;
    name: string;
    status: string;
    last_heartbeat_at: string | null;
    created_at: string;
    updated_at: string;
};

type SystemHealth = {
    status: string;
    database: {
        status: string;
        latency?: string;
        error?: string;
    };
    components?: Record<string, { status: string; latency?: string; error?: string }>;
};

type AuditLog = {
    id: number;
    event_type: string;
    actor_name: string;
    target_type: string;
    target_name: string;
    action: string;
    created_at: string;
};

type CountSummary = {
    users: number;
    orgs: number;
    repos: number;
    runners: number;
};

const SECTIONS: Array<{
    id: AdminSection;
    label: string;
    href: string;
    icon: typeof Shield;
}> = [
    { id: "overview", label: "Overview", href: "/admin", icon: Shield },
    { id: "users", label: "Users", href: "/admin/users", icon: Users },
    { id: "orgs", label: "Organizations", href: "/admin/orgs", icon: Building2 },
    { id: "repos", label: "Repositories", href: "/admin/repos", icon: Boxes },
    { id: "runners", label: "Runners", href: "/admin/runners", icon: Cpu },
    { id: "workflows", label: "Workflows", href: "/admin/workflows", icon: Workflow },
    { id: "health", label: "Health", href: "/admin/health", icon: HeartPulse },
];

function sectionFromPath(pathname: string): AdminSection {
    if (pathname === "/admin" || pathname === "/admin/") {
        return "overview";
    }
    if (pathname.startsWith("/admin/users")) {
        return "users";
    }
    if (pathname.startsWith("/admin/orgs")) {
        return "orgs";
    }
    if (pathname.startsWith("/admin/repos")) {
        return "repos";
    }
    if (pathname.startsWith("/admin/runners")) {
        return "runners";
    }
    if (pathname.startsWith("/admin/workflows")) {
        return "workflows";
    }
    if (pathname.startsWith("/admin/health")) {
        return "health";
    }
    return "overview";
}

async function fetchCollection<T>(url: string, fallback: string): Promise<{ items: T[]; total: number }> {
    const response = await fetch(url, {
        credentials: "include",
        headers: withAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error(await readErrorMessage(response, fallback));
    }
    const payload = (await response.json()) as T[];
    const headerValue = Number.parseInt(response.headers.get("X-Total-Count") ?? "", 10);
    return {
        items: Array.isArray(payload) ? payload : [],
        total: Number.isFinite(headerValue) ? headerValue : Array.isArray(payload) ? payload.length : 0,
    };
}

async function fetchJson<T>(url: string, fallback: string): Promise<T> {
    const response = await fetch(url, {
        credentials: "include",
        headers: withAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error(await readErrorMessage(response, fallback));
    }
    return await response.json() as T;
}

export default function AdminConsoleView() {
    const location = useLocation();
    const activeSection = createMemo<AdminSection>(() => sectionFromPath(location.pathname));

    const [isLoading, setIsLoading] = createSignal(true);
    const [isSaving, setIsSaving] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [notice, setNotice] = createSignal<string | null>(null);

    const [users, setUsers] = createSignal<AdminUser[]>([]);
    const [orgs, setOrgs] = createSignal<AdminOrg[]>([]);
    const [repos, setRepos] = createSignal<AdminRepo[]>([]);
    const [runners, setRunners] = createSignal<AdminRunner[]>([]);
    const [health, setHealth] = createSignal<SystemHealth | null>(null);
    const [auditLogs, setAuditLogs] = createSignal<AuditLog[]>([]);
    const [counts, setCounts] = createSignal<CountSummary>({
        users: 0,
        orgs: 0,
        repos: 0,
        runners: 0,
    });

    const [newUsername, setNewUsername] = createSignal("");
    const [newEmail, setNewEmail] = createSignal("");
    const [newDisplayName, setNewDisplayName] = createSignal("");
    const [runnerStatusFilter, setRunnerStatusFilter] = createSignal("");

    const loadOverview = async () => {
        const [usersResult, orgsResult, reposResult, runnersResult, healthResult, auditResult] = await Promise.all([
            fetchCollection<AdminUser>("/api/admin/users?limit=5", "Failed to load users"),
            fetchCollection<AdminOrg>("/api/admin/orgs?limit=5", "Failed to load organizations"),
            fetchCollection<AdminRepo>("/api/admin/repos?limit=5", "Failed to load repositories"),
            fetchCollection<AdminRunner>("/api/admin/runners?limit=5", "Failed to load runners"),
            fetchJson<SystemHealth>("/api/admin/system/health", "Failed to load system health"),
            fetchJson<AuditLog[]>(`/api/admin/audit-logs?since=${encodeURIComponent(daysAgoISOString(7))}&limit=10`, "Failed to load audit log"),
        ]);
        setUsers(usersResult.items);
        setOrgs(orgsResult.items);
        setRepos(reposResult.items);
        setRunners(runnersResult.items);
        setHealth(healthResult);
        setAuditLogs(Array.isArray(auditResult) ? auditResult : []);
        setCounts({
            users: usersResult.total,
            orgs: orgsResult.total,
            repos: reposResult.total,
            runners: runnersResult.total,
        });
    };

    const loadUsers = async () => {
        const result = await fetchCollection<AdminUser>("/api/admin/users?limit=50", "Failed to load users");
        setUsers(result.items);
        setCounts((current) => ({ ...current, users: result.total }));
    };

    const loadOrgs = async () => {
        const result = await fetchCollection<AdminOrg>("/api/admin/orgs?limit=50", "Failed to load organizations");
        setOrgs(result.items);
        setCounts((current) => ({ ...current, orgs: result.total }));
    };

    const loadRepos = async () => {
        const result = await fetchCollection<AdminRepo>("/api/admin/repos?limit=50", "Failed to load repositories");
        setRepos(result.items);
        setCounts((current) => ({ ...current, repos: result.total }));
    };

    const loadRunners = async () => {
        const suffix = runnerStatusFilter() ? `?status=${encodeURIComponent(runnerStatusFilter())}&limit=50` : "?limit=50";
        const result = await fetchCollection<AdminRunner>(`/api/admin/runners${suffix}`, "Failed to load runners");
        setRunners(result.items);
        setCounts((current) => ({ ...current, runners: result.total }));
    };

    const loadHealth = async () => {
        const [healthResult, auditResult] = await Promise.all([
            fetchJson<SystemHealth>("/api/admin/system/health", "Failed to load system health"),
            fetchJson<AuditLog[]>(`/api/admin/audit-logs?since=${encodeURIComponent(daysAgoISOString(7))}&limit=25`, "Failed to load audit log"),
        ]);
        setHealth(healthResult);
        setAuditLogs(Array.isArray(auditResult) ? auditResult : []);
    };

    const loadSection = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            switch (activeSection()) {
                case "overview":
                    await loadOverview();
                    break;
                case "users":
                    await loadUsers();
                    break;
                case "orgs":
                    await loadOrgs();
                    break;
                case "repos":
                    await loadRepos();
                    break;
                case "runners":
                    await loadRunners();
                    break;
                case "health":
                    await loadHealth();
                    break;
                case "workflows":
                    setAuditLogs([]);
                    break;
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to load admin console");
        } finally {
            setIsLoading(false);
        }
    };

    createEffect(() => {
        void activeSection();
        void runnerStatusFilter();
        void loadSection();
    });

    const createUser = async (event: Event) => {
        event.preventDefault();
        if (!newUsername().trim()) {
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);
        setNotice(null);
        try {
            const response = await fetch("/api/admin/users", {
                method: "POST",
                credentials: "include",
                headers: withAuthHeaders({
                    "Content-Type": "application/json",
                }),
                body: JSON.stringify({
                    username: newUsername().trim(),
                    email: newEmail().trim(),
                    display_name: newDisplayName().trim(),
                }),
            });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, "Failed to create user"));
            }
            const created = (await response.json()) as AdminUser;
            setUsers((current) => [created, ...current.filter((entry) => entry.id !== created.id)]);
            setCounts((current) => ({ ...current, users: current.users + 1 }));
            setNotice(`Created user ${created.username}.`);
            setNewUsername("");
            setNewEmail("");
            setNewDisplayName("");
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to create user");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleAdmin = async (user: AdminUser) => {
        setIsSaving(true);
        setErrorMessage(null);
        setNotice(null);
        try {
            const response = await fetch(`/api/admin/users/${encodeURIComponent(user.username)}/admin`, {
                method: "PATCH",
                credentials: "include",
                headers: withAuthHeaders({
                    "Content-Type": "application/json",
                }),
                body: JSON.stringify({
                    is_admin: !user.is_admin,
                }),
            });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, "Failed to update admin access"));
            }
            const updated = (await response.json()) as AdminUser;
            setUsers((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
            setNotice(`${updated.username} is now ${updated.is_admin ? "an admin" : "a regular user"}.`);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to update admin access");
        } finally {
            setIsSaving(false);
        }
    };

    const deleteUser = async (user: AdminUser) => {
        if (!confirm(`Deactivate ${user.username}?`)) {
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);
        setNotice(null);
        try {
            const response = await fetch(`/api/admin/users/${encodeURIComponent(user.username)}`, {
                method: "DELETE",
                credentials: "include",
                headers: withAuthHeaders(),
            });
            if (!response.ok && response.status !== 204) {
                throw new Error(await readErrorMessage(response, "Failed to delete user"));
            }
            setUsers((current) => current.filter((entry) => entry.id !== user.id));
            setCounts((current) => ({ ...current, users: Math.max(0, current.users - 1) }));
            setNotice(`Deactivated ${user.username}.`);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to delete user");
        } finally {
            setIsSaving(false);
        }
    };

    const renderAuditLogs = () => (
        <Show when={auditLogs().length > 0} fallback={
            <div class="surface-empty">
                <h3>No recent audit activity</h3>
            </div>
        }>
            <div class="surface-list">
                <For each={auditLogs()}>
                    {(entry) => (
                        <div class="surface-row">
                            <div class="surface-row-main">
                                <div class="surface-row-title">
                                    <h3>{entry.event_type}</h3>
                                    <span class="surface-tag">{entry.action}</span>
                                </div>
                                <div class="surface-meta">
                                    <span>{entry.actor_name || "system"}</span>
                                    <span>{entry.target_type}: {entry.target_name || "n/a"}</span>
                                    <span>{formatDateTime(entry.created_at)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </For>
            </div>
        </Show>
    );

    const renderOverview = () => (
        <div class="surface-stack">
            <div class="surface-stat-grid">
                <div class="surface-stat">
                    <span>Total users</span>
                    <strong>{counts().users}</strong>
                </div>
                <div class="surface-stat">
                    <span>Total orgs</span>
                    <strong>{counts().orgs}</strong>
                </div>
                <div class="surface-stat">
                    <span>Total repos</span>
                    <strong>{counts().repos}</strong>
                </div>
                <div class="surface-stat">
                    <span>Runners</span>
                    <strong>{counts().runners}</strong>
                </div>
                <div class="surface-stat">
                    <span>System health</span>
                    <strong>{health()?.status ?? "unknown"}</strong>
                </div>
            </div>

            <div class="surface-card">
                <div class="surface-card-header">
                    <div>
                        <h2>Recent audit activity</h2>
                        <p>Events recorded over the last seven days.</p>
                    </div>
                    <Activity size={20} class="text-muted" />
                </div>
                {renderAuditLogs()}
            </div>
        </div>
    );

    const renderUsers = () => (
        <div class="surface-stack">
            <form class="surface-card surface-form" onSubmit={createUser}>
                <div class="surface-card-header">
                    <div>
                        <h2>Create user</h2>
                        <p>Provision a local JJHub account directly from the admin console.</p>
                    </div>
                    <UserCog size={20} class="text-muted" />
                </div>

                <div class="surface-inline-fields">
                    <div class="surface-field">
                        <label for="admin-user-username">Username</label>
                        <input
                            id="admin-user-username"
                            type="text"
                            value={newUsername()}
                            onInput={(event) => setNewUsername(event.currentTarget.value)}
                            placeholder="new-user"
                            required
                        />
                    </div>
                    <div class="surface-field">
                        <label for="admin-user-email">Email</label>
                        <input
                            id="admin-user-email"
                            type="email"
                            value={newEmail()}
                            onInput={(event) => setNewEmail(event.currentTarget.value)}
                            placeholder="name@example.com"
                        />
                    </div>
                    <div class="surface-field">
                        <label for="admin-user-display-name">Display name</label>
                        <input
                            id="admin-user-display-name"
                            type="text"
                            value={newDisplayName()}
                            onInput={(event) => setNewDisplayName(event.currentTarget.value)}
                            placeholder="Team Operator"
                        />
                    </div>
                </div>

                <div class="surface-form-actions">
                    <button type="submit" class="primary-btn" disabled={isSaving() || !newUsername().trim()}>
                        <Plus size={16} />
                        {isSaving() ? "Creating..." : "Create User"}
                    </button>
                </div>
            </form>

            <Show when={users().length > 0} fallback={
                <div class="surface-empty">
                    <h3>No users found</h3>
                </div>
            }>
                <div class="surface-list">
                    <For each={users()}>
                        {(user) => (
                            <div class="surface-row">
                                <div class="surface-row-main">
                                    <div class="surface-row-title">
                                        <h3>{user.username}</h3>
                                        <Show when={user.is_admin}>
                                            <span class="surface-tag">
                                                <Shield size={12} />
                                                Admin
                                            </span>
                                        </Show>
                                    </div>
                                    <div class="surface-meta">
                                        <span>{user.display_name || "No display name"}</span>
                                        <span>{user.email || "No email"}</span>
                                        <span>Created {formatDateTime(user.created_at)}</span>
                                    </div>
                                </div>
                                <div class="surface-row-actions">
                                    <button class="secondary-btn" disabled={isSaving()} onClick={() => void toggleAdmin(user)}>
                                        {user.is_admin ? "Revoke admin" : "Grant admin"}
                                    </button>
                                    <button class="danger-btn" disabled={isSaving()} onClick={() => void deleteUser(user)} title="Delete user">
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

    const renderOrgs = () => (
        <Show when={orgs().length > 0} fallback={
            <div class="surface-empty">
                <h3>No organizations found</h3>
            </div>
        }>
            <div class="surface-list">
                <For each={orgs()}>
                    {(org) => (
                        <div class="surface-row">
                            <div class="surface-row-main">
                                <div class="surface-row-title">
                                    <h3>{org.name}</h3>
                                    <span class="surface-tag">{org.visibility}</span>
                                </div>
                                <div class="surface-meta">
                                    <span>{org.description || "No description"}</span>
                                    <Show when={org.website}><span>{org.website}</span></Show>
                                    <Show when={org.location}><span>{org.location}</span></Show>
                                </div>
                            </div>
                        </div>
                    )}
                </For>
            </div>
        </Show>
    );

    const renderRepos = () => (
        <Show when={repos().length > 0} fallback={
            <div class="surface-empty">
                <h3>No repositories found</h3>
            </div>
        }>
            <div class="surface-list">
                <For each={repos()}>
                    {(repo) => (
                        <div class="surface-row">
                            <div class="surface-row-main">
                                <div class="surface-row-title">
                                    <h3>{repo.name}</h3>
                                    <span class="surface-tag">{repo.is_public ? "Public" : "Private"}</span>
                                    <Show when={repo.is_archived}>
                                        <span class="surface-tag">Archived</span>
                                    </Show>
                                </div>
                                <div class="surface-meta">
                                    <span>{repo.description || "No description"}</span>
                                    <span>{repo.num_stars} stars</span>
                                    <span>{repo.num_issues} issues</span>
                                    <span>Updated {formatDateTime(repo.updated_at)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </For>
            </div>
        </Show>
    );

    const renderRunners = () => (
        <div class="surface-stack">
            <div class="surface-card">
                <div class="surface-inline-fields">
                    <div class="surface-field">
                        <label for="runner-status-filter">Status filter</label>
                        <select
                            id="runner-status-filter"
                            value={runnerStatusFilter()}
                            onChange={(event) => setRunnerStatusFilter(event.currentTarget.value)}
                        >
                            <option value="">All runners</option>
                            <option value="idle">Idle</option>
                            <option value="busy">Busy</option>
                            <option value="offline">Offline</option>
                            <option value="draining">Draining</option>
                        </select>
                    </div>
                </div>
            </div>

            <Show when={runners().length > 0} fallback={
                <div class="surface-empty">
                    <h3>No runners found</h3>
                </div>
            }>
                <div class="surface-list">
                    <For each={runners()}>
                        {(runner) => (
                            <div class="surface-row">
                                <div class="surface-row-main">
                                    <div class="surface-row-title">
                                        <h3>{runner.name}</h3>
                                        <span class="surface-tag">{runner.status}</span>
                                    </div>
                                    <div class="surface-meta">
                                        <span>Heartbeat {runner.last_heartbeat_at ? formatDateTime(runner.last_heartbeat_at) : "Never"}</span>
                                        <span>Updated {formatDateTime(runner.updated_at)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </For>
                </div>
            </Show>
        </div>
    );

    const renderHealth = () => (
        <div class="surface-stack">
            <Show when={health()}>
                {(system) => (
                    <div class="surface-card">
                        <div class="surface-card-header">
                            <div>
                                <h2>System health</h2>
                                <p>Operational diagnostics for critical services.</p>
                            </div>
                            <HeartPulse size={20} class="text-muted" />
                        </div>
                        <div class="surface-stat-grid">
                            <div class="surface-stat">
                                <span>Overall status</span>
                                <strong>{system().status}</strong>
                            </div>
                            <div class="surface-stat">
                                <span>Database</span>
                                <strong>{system().database.status}</strong>
                                <Show when={system().database.latency}>
                                    <span>{system().database.latency}</span>
                                </Show>
                                <Show when={system().database.error}>
                                    <span>{system().database.error}</span>
                                </Show>
                            </div>
                            <For each={Object.entries(system().components ?? {})}>
                                {([name, component]) => (
                                    <div class="surface-stat">
                                        <span>{name}</span>
                                        <strong>{component.status}</strong>
                                        <Show when={component.latency}>
                                            <span>{component.latency}</span>
                                        </Show>
                                        <Show when={component.error}>
                                            <span>{component.error}</span>
                                        </Show>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                )}
            </Show>

            <div class="surface-card">
                <div class="surface-card-header">
                    <div>
                        <h2>Audit log</h2>
                        <p>Recent admin and system actions.</p>
                    </div>
                    <Activity size={20} class="text-muted" />
                </div>
                {renderAuditLogs()}
            </div>
        </div>
    );

    return (
        <div class="surface-page">
            <header class="surface-header">
                <div>
                    <h1>Admin Console</h1>
                    <p>Inspect platform state, manage operators and accounts, and monitor core system health.</p>
                </div>
            </header>

            <Show when={errorMessage()}>
                {(message) => <div class="surface-banner error">{message()}</div>}
            </Show>
            <Show when={notice()}>
                {(message) => <div class="surface-banner success">{message()}</div>}
            </Show>

            <div class="surface-shell">
                <nav class="surface-nav">
                    <For each={SECTIONS}>
                        {(section) => (
                            <a
                                href={section.href}
                                class={`surface-nav-link ${activeSection() === section.id ? "active" : ""}`}
                            >
                                <section.icon size={16} />
                                {section.label}
                                <Show when={section.id === "users"}>
                                    <span class="surface-nav-badge">{counts().users}</span>
                                </Show>
                            </a>
                        )}
                    </For>
                </nav>

                <div class="surface-stack">
                    <Show when={isLoading()}>
                        <div class="surface-empty">
                            <h3>Loading admin console...</h3>
                        </div>
                    </Show>

                    <Show when={!isLoading()}>
                        {activeSection() === "overview" && renderOverview()}
                        {activeSection() === "users" && renderUsers()}
                        {activeSection() === "orgs" && renderOrgs()}
                        {activeSection() === "repos" && renderRepos()}
                        {activeSection() === "runners" && renderRunners()}
                        {activeSection() === "health" && renderHealth()}
                        {activeSection() === "workflows" && (
                            <div class="surface-placeholder">
                                <Workflow size={28} style={{ margin: "0 auto 0.75rem" }} />
                                <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--text-primary)" }}>Admin workflows</h3>
                                <p style={{ margin: 0 }}>Workflow operations are not exposed through the admin API yet.</p>
                            </div>
                        )}
                    </Show>
                </div>
            </div>
        </div>
    );
}
