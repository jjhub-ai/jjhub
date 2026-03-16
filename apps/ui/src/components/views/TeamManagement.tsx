import { createSignal, onMount, For, Show } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import {
    Shield, Users, Database, Plus, Trash2, ArrowLeft, Edit2,
    CheckCircle2, X, ChevronRight, Building2
} from "lucide-solid";
import { withAuthHeaders } from "../../lib/repoContext";
import "./OrgSettings.css";

type TeamInfo = {
    id: number;
    name: string;
    description: string;
    permission: string;
};

type TeamMember = {
    id: number;
    username: string;
    display_name: string;
    avatar_url: string;
};

type TeamRepo = {
    id: number;
    name: string;
    full_name: string;
    description: string;
    private: boolean;
    owner: { login: string };
};

type OrgTeam = {
    id: number;
    name: string;
    description: string;
    permission: string;
};

/** Teams list view for /orgs/:org/teams */
export function TeamsList() {
    const params = useParams<{ org: string }>();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = createSignal(true);
    const [teams, setTeams] = createSignal<OrgTeam[]>([]);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [successMessage, setSuccessMessage] = createSignal<string | null>(null);
    const [isSaving, setIsSaving] = createSignal(false);

    // Create team form
    const [isCreating, setIsCreating] = createSignal(false);
    const [newName, setNewName] = createSignal("");
    const [newDesc, setNewDesc] = createSignal("");
    const [newPerm, setNewPerm] = createSignal("read");

    const loadTeams = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const res = await fetch(`/api/orgs/${params.org}/teams`, { headers: withAuthHeaders() });
            if (!res.ok) throw new Error("Failed to load teams");
            setTeams(await res.json());
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsLoading(false);
        }
    };

    onMount(() => void loadTeams());

    const createTeam = async (e: Event) => {
        e.preventDefault();
        if (!newName().trim()) return;
        setIsSaving(true);
        setErrorMessage(null);
        try {
            const res = await fetch(`/api/orgs/${params.org}/teams`, {
                method: "POST",
                headers: withAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({
                    name: newName().trim(),
                    description: newDesc().trim(),
                    permission: newPerm(),
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error((body as { message?: string })?.message ?? "Failed to create team");
            }
            setIsCreating(false);
            setNewName("");
            setNewDesc("");
            setNewPerm("read");
            setSuccessMessage("Team created successfully");
            setTimeout(() => setSuccessMessage(null), 3000);
            void loadTeams();
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    };

    const deleteTeam = async (name: string) => {
        if (!confirm(`Delete team "${name}"? This action cannot be undone.`)) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/orgs/${params.org}/teams/${name}`, {
                method: "DELETE",
                headers: withAuthHeaders(),
            });
            if (!res.ok) throw new Error("Failed to delete team");
            setTeams(teams().filter((t) => t.name !== name));
            setSuccessMessage("Team deleted");
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div class="org-settings-view bg-root text-primary min-h-full">
            <div class="max-w-4xl mx-auto w-full p-8 pb-32">
                <header class="flex items-center gap-4 mb-8 pb-6 border-b border-color">
                    <button
                        class="text-muted hover:text-primary transition-colors p-1 rounded"
                        onClick={() => navigate(`/orgs/${params.org}/settings`)}
                        title="Back to org settings"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div class="org-avatar w-10 h-10 rounded-xl bg-purple/10 border border-purple/20 flex items-center justify-center text-purple text-lg font-bold">
                        {params.org.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="flex items-center gap-2 text-sm text-muted">
                            <span class="hover:text-primary cursor-pointer" onClick={() => navigate(`/orgs/${params.org}/settings`)}>{params.org}</span>
                            <ChevronRight size={14} />
                            <span>Teams</span>
                        </div>
                        <h1 class="text-xl font-semibold m-0">Team Management</h1>
                    </div>
                    <div class="ml-auto">
                        <Show when={!isCreating()}>
                            <button class="btn btn-primary btn-sm flex items-center gap-1.5" onClick={() => setIsCreating(true)}>
                                <Plus size={14} /> New Team
                            </button>
                        </Show>
                    </div>
                </header>

                <Show when={errorMessage()}>
                    <div class="p-3 mb-6 bg-red/10 border border-red/20 text-red rounded-lg text-sm">
                        {errorMessage()}
                    </div>
                </Show>
                <Show when={successMessage()}>
                    <div class="p-3 mb-6 bg-green/10 border border-green/20 text-green rounded-lg text-sm flex items-center gap-2">
                        <CheckCircle2 size={16} />
                        {successMessage()}
                    </div>
                </Show>

                <Show when={isCreating()}>
                    <form class="bg-panel border border-blue shadow-[0_0_0_1px_rgba(123,147,217,0.3)] rounded-xl p-5 mb-6 animate-in" onSubmit={createTeam}>
                        <h3 class="font-medium mb-4 flex items-center gap-2">
                            <Shield size={16} class="text-blue" />
                            Create a new team
                        </h3>
                        <div class="grid gap-4 mb-4">
                            <div>
                                <label class="block text-sm text-muted mb-1">Team Name</label>
                                <input
                                    type="text"
                                    required
                                    value={newName()}
                                    onInput={(e) => setNewName(e.currentTarget.value)}
                                    class="w-full bg-app border border-color rounded-lg px-3 py-1.5 outline-none focus:border-blue text-primary"
                                    placeholder="e.g. backend-engineers"
                                    autofocus
                                />
                            </div>
                            <div>
                                <label class="block text-sm text-muted mb-1">Description</label>
                                <input
                                    type="text"
                                    value={newDesc()}
                                    onInput={(e) => setNewDesc(e.currentTarget.value)}
                                    class="w-full bg-app border border-color rounded-lg px-3 py-1.5 outline-none focus:border-blue text-primary"
                                    placeholder="What does this team do?"
                                />
                            </div>
                            <div>
                                <label class="block text-sm text-muted mb-1">Default Repository Permission</label>
                                <select
                                    value={newPerm()}
                                    onChange={(e) => setNewPerm(e.currentTarget.value)}
                                    class="w-full bg-app border border-color rounded-lg px-3 py-1.5 outline-none focus:border-blue cursor-pointer text-primary"
                                >
                                    <option value="read">Read (Clone and pull only)</option>
                                    <option value="write">Write (Push to repositories)</option>
                                    <option value="admin">Admin (Full repository access)</option>
                                </select>
                            </div>
                        </div>
                        <div class="flex justify-end gap-2 pt-4 border-t border-color">
                            <button type="button" class="btn" onClick={() => setIsCreating(false)}>Cancel</button>
                            <button type="submit" class="btn btn-primary" disabled={isSaving()}>
                                {isSaving() ? "Creating..." : "Create Team"}
                            </button>
                        </div>
                    </form>
                </Show>

                <Show when={isLoading()}>
                    <div class="p-8 text-center text-muted border border-color rounded-xl bg-panel">
                        Loading teams...
                    </div>
                </Show>

                <Show when={!isLoading()}>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <For each={teams()}>
                            {(team) => (
                                <div class="bg-panel border border-color rounded-xl p-5 shadow-sm group hover:border-blue/40 transition-colors flex flex-col">
                                    <div class="flex items-start justify-between mb-2">
                                        <h3
                                            class="font-medium text-lg m-0 flex items-center gap-2 cursor-pointer hover:text-blue transition-colors"
                                            onClick={() => navigate(`/orgs/${params.org}/teams/${team.name}`)}
                                        >
                                            <Shield size={16} class="text-blue" />
                                            {team.name}
                                        </h3>
                                        <button
                                            class="text-muted hover:text-red opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                            onClick={() => void deleteTeam(team.name)}
                                            disabled={isSaving()}
                                            title="Delete team"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <p class="text-sm text-muted m-0 mb-4 flex-1">
                                        {team.description || "No description provided."}
                                    </p>
                                    <div class="flex items-center justify-between pt-4 border-t border-color mt-auto">
                                        <span class="text-xs uppercase tracking-wide text-muted font-medium flex items-center gap-1.5">
                                            <Shield size={12} />
                                            {team.permission} access
                                        </span>
                                        <button
                                            class="text-xs text-blue hover:underline"
                                            onClick={() => navigate(`/orgs/${params.org}/teams/${team.name}`)}
                                        >
                                            Manage team
                                        </button>
                                    </div>
                                </div>
                            )}
                        </For>
                        <Show when={teams().length === 0 && !isCreating()}>
                            <div class="col-span-full p-8 text-center bg-panel border-dashed border border-color rounded-xl text-muted">
                                <Building2 size={24} class="mx-auto mb-3 opacity-50" />
                                <p class="m-0 text-sm">No teams in this organization yet.</p>
                                <button class="text-blue mt-2 text-sm hover:underline" onClick={() => setIsCreating(true)}>
                                    Create your first team
                                </button>
                            </div>
                        </Show>
                    </div>
                </Show>
            </div>
        </div>
    );
}

/** Individual team detail view for /orgs/:org/teams/:team */
export default function TeamManagement() {
    const params = useParams<{ org: string; team: string }>();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = createSignal<"settings" | "members" | "repos">("members");
    const [isLoading, setIsLoading] = createSignal(true);
    const [isSaving, setIsSaving] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [successMessage, setSuccessMessage] = createSignal<string | null>(null);

    // Team data
    const [teamInfo, setTeamInfo] = createSignal<TeamInfo | null>(null);
    const [members, setMembers] = createSignal<TeamMember[]>([]);
    const [repos, setRepos] = createSignal<TeamRepo[]>([]);

    // Edit form
    const [editDesc, setEditDesc] = createSignal("");
    const [editPerm, setEditPerm] = createSignal("read");
    const [isEditing, setIsEditing] = createSignal(false);

    // Add member form
    const [newMemberUsername, setNewMemberUsername] = createSignal("");

    // Add repo form
    const [newRepoOwner, setNewRepoOwner] = createSignal("");
    const [newRepoName, setNewRepoName] = createSignal("");

    const showSuccess = (msg: string) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    const loadData = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const [teamRes, membersRes, reposRes] = await Promise.all([
                fetch(`/api/orgs/${params.org}/teams/${params.team}`, { headers: withAuthHeaders() }),
                fetch(`/api/orgs/${params.org}/teams/${params.team}/members`, { headers: withAuthHeaders() }),
                fetch(`/api/orgs/${params.org}/teams/${params.team}/repos`, { headers: withAuthHeaders() }),
            ]);

            if (teamRes.ok) {
                const info = (await teamRes.json()) as TeamInfo;
                setTeamInfo(info);
                setEditDesc(info.description || "");
                setEditPerm(info.permission || "read");
            } else {
                throw new Error("Failed to load team");
            }
            if (membersRes.ok) {
                setMembers(await membersRes.json());
            }
            if (reposRes.ok) {
                setRepos(await reposRes.json());
            }
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsLoading(false);
        }
    };

    onMount(() => void loadData());

    const updateTeam = async (e: Event) => {
        e.preventDefault();
        setIsSaving(true);
        setErrorMessage(null);
        try {
            const res = await fetch(`/api/orgs/${params.org}/teams/${params.team}`, {
                method: "PATCH",
                headers: withAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({
                    description: editDesc(),
                    permission: editPerm(),
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error((body as { message?: string })?.message ?? "Failed to update team");
            }
            const updated = (await res.json()) as TeamInfo;
            setTeamInfo(updated);
            setIsEditing(false);
            showSuccess("Team updated successfully");
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    };

    const addMember = async (e: Event) => {
        e.preventDefault();
        const username = newMemberUsername().trim();
        if (!username) return;
        setIsSaving(true);
        setErrorMessage(null);
        try {
            const res = await fetch(`/api/orgs/${params.org}/teams/${params.team}/members/${encodeURIComponent(username)}`, {
                method: "PUT",
                headers: withAuthHeaders(),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error((body as { message?: string })?.message ?? "Failed to add member");
            }
            setNewMemberUsername("");
            showSuccess(`Added ${username} to the team`);
            void loadData();
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    };

    const removeMember = async (username: string) => {
        if (!confirm(`Remove ${username} from team ${params.team}?`)) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/orgs/${params.org}/teams/${params.team}/members/${encodeURIComponent(username)}`, {
                method: "DELETE",
                headers: withAuthHeaders(),
            });
            if (!res.ok) throw new Error("Failed to remove member");
            setMembers(members().filter((m) => m.username !== username));
            showSuccess(`Removed ${username} from the team`);
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    };

    const addRepo = async (e: Event) => {
        e.preventDefault();
        const owner = newRepoOwner().trim() || params.org;
        const repo = newRepoName().trim();
        if (!repo) return;
        setIsSaving(true);
        setErrorMessage(null);
        try {
            const res = await fetch(
                `/api/orgs/${params.org}/teams/${params.team}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
                {
                    method: "PUT",
                    headers: withAuthHeaders(),
                },
            );
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error((body as { message?: string })?.message ?? "Failed to add repository");
            }
            setNewRepoOwner("");
            setNewRepoName("");
            showSuccess(`Added ${owner}/${repo} to the team`);
            void loadData();
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    };

    const removeRepo = async (owner: string, repo: string) => {
        if (!confirm(`Remove ${owner}/${repo} from team ${params.team}?`)) return;
        setIsSaving(true);
        try {
            const res = await fetch(
                `/api/orgs/${params.org}/teams/${params.team}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
                {
                    method: "DELETE",
                    headers: withAuthHeaders(),
                },
            );
            if (!res.ok) throw new Error("Failed to remove repository");
            setRepos(repos().filter((r) => !(r.owner?.login === owner && r.name === repo) && r.full_name !== `${owner}/${repo}`));
            showSuccess(`Removed ${owner}/${repo} from the team`);
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    };

    const deleteTeam = async () => {
        if (!confirm(`Delete team "${params.team}"? This action cannot be undone.`)) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/orgs/${params.org}/teams/${params.team}`, {
                method: "DELETE",
                headers: withAuthHeaders(),
            });
            if (!res.ok) throw new Error("Failed to delete team");
            navigate(`/orgs/${params.org}/teams`);
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div class="org-settings-view bg-root text-primary min-h-full">
            <div class="max-w-5xl mx-auto w-full p-8 pb-32">
                <header class="flex items-center gap-4 mb-8 pb-6 border-b border-color">
                    <button
                        class="text-muted hover:text-primary transition-colors p-1 rounded"
                        onClick={() => navigate(`/orgs/${params.org}/teams`)}
                        title="Back to teams"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div class="org-avatar w-10 h-10 rounded-xl bg-blue/10 border border-blue/20 flex items-center justify-center text-blue">
                        <Shield size={20} />
                    </div>
                    <div>
                        <div class="flex items-center gap-2 text-sm text-muted">
                            <span class="hover:text-primary cursor-pointer" onClick={() => navigate(`/orgs/${params.org}/settings`)}>{params.org}</span>
                            <ChevronRight size={14} />
                            <span class="hover:text-primary cursor-pointer" onClick={() => navigate(`/orgs/${params.org}/teams`)}>Teams</span>
                            <ChevronRight size={14} />
                            <span>{params.team}</span>
                        </div>
                        <h1 class="text-xl font-semibold m-0">{params.team}</h1>
                    </div>
                </header>

                <div class="flex flex-col md:flex-row gap-8">
                    <nav class="settings-nav w-full md:w-64 flex-shrink-0 flex flex-col gap-1">
                        <button
                            class={`nav-tab border border-transparent ${activeTab() === "members" ? "active shadow-sm" : "hover:bg-panel-hover"}`}
                            onClick={() => setActiveTab("members")}
                        >
                            <Users size={16} />
                            Members
                            <span class="badge ml-auto">{members().length}</span>
                        </button>
                        <button
                            class={`nav-tab border border-transparent ${activeTab() === "repos" ? "active shadow-sm" : "hover:bg-panel-hover"}`}
                            onClick={() => setActiveTab("repos")}
                        >
                            <Database size={16} />
                            Repositories
                            <span class="badge ml-auto">{repos().length}</span>
                        </button>
                        <button
                            class={`nav-tab border border-transparent ${activeTab() === "settings" ? "active shadow-sm" : "hover:bg-panel-hover"}`}
                            onClick={() => setActiveTab("settings")}
                        >
                            <Edit2 size={16} />
                            Settings
                        </button>
                    </nav>

                    <div class="settings-content flex-1 min-w-0">
                        <Show when={errorMessage()}>
                            <div class="p-3 mb-6 bg-red/10 border border-red/20 text-red rounded-lg text-sm flex items-center gap-2">
                                <X size={16} class="flex-shrink-0 cursor-pointer" onClick={() => setErrorMessage(null)} />
                                {errorMessage()}
                            </div>
                        </Show>
                        <Show when={successMessage()}>
                            <div class="p-3 mb-6 bg-green/10 border border-green/20 text-green rounded-lg text-sm flex items-center gap-2">
                                <CheckCircle2 size={16} />
                                {successMessage()}
                            </div>
                        </Show>

                        <Show when={isLoading()}>
                            <div class="p-8 text-center text-muted border border-color rounded-xl bg-panel">
                                Loading team data...
                            </div>
                        </Show>

                        <Show when={!isLoading()}>
                            {/* Members Tab */}
                            <Show when={activeTab() === "members"}>
                                <div class="settings-section animate-in">
                                    <div class="flex items-center justify-between mb-4">
                                        <h2 class="text-lg font-medium m-0">Team Members</h2>
                                    </div>

                                    <form class="bg-panel border border-color rounded-xl p-4 mb-6 flex items-end gap-3" onSubmit={addMember}>
                                        <div class="flex-1">
                                            <label class="block text-xs font-medium text-muted mb-1">Username</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. alice"
                                                required
                                                value={newMemberUsername()}
                                                onInput={(e) => setNewMemberUsername(e.currentTarget.value)}
                                                class="w-full bg-app border border-color rounded-lg px-3 py-1.5 focus:border-blue outline-none transition-colors text-primary"
                                            />
                                        </div>
                                        <button type="submit" class="btn btn-primary whitespace-nowrap" disabled={isSaving()}>
                                            <Plus size={14} class="mr-1" />
                                            Add Member
                                        </button>
                                    </form>

                                    <div class="bg-panel border border-color rounded-xl overflow-hidden shadow-sm">
                                        <For each={members()}>
                                            {(member) => (
                                                <div class="flex items-center justify-between p-4 border-b border-color last:border-0 hover:bg-panel-hover transition-colors">
                                                    <div class="flex items-center gap-3">
                                                        <div class="w-8 h-8 rounded-full bg-blue/10 flex items-center justify-center text-blue font-medium text-sm">
                                                            {member.username.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div class="font-medium">{member.username}</div>
                                                            <Show when={member.display_name && member.display_name !== member.username}>
                                                                <div class="text-xs text-muted">{member.display_name}</div>
                                                            </Show>
                                                        </div>
                                                    </div>
                                                    <button
                                                        class="text-muted hover:text-red transition-colors p-1 rounded"
                                                        onClick={() => void removeMember(member.username)}
                                                        disabled={isSaving()}
                                                        title="Remove from team"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </For>
                                        <Show when={members().length === 0}>
                                            <div class="p-8 text-center text-muted">
                                                <Users size={24} class="mx-auto mb-3 opacity-50" />
                                                <p class="m-0 text-sm">No members in this team yet.</p>
                                            </div>
                                        </Show>
                                    </div>
                                </div>
                            </Show>

                            {/* Repos Tab */}
                            <Show when={activeTab() === "repos"}>
                                <div class="settings-section animate-in">
                                    <div class="flex items-center justify-between mb-4">
                                        <h2 class="text-lg font-medium m-0">Repository Access</h2>
                                    </div>

                                    <form class="bg-panel border border-color rounded-xl p-4 mb-6 flex items-end gap-3" onSubmit={addRepo}>
                                        <div class="w-40">
                                            <label class="block text-xs font-medium text-muted mb-1">Owner</label>
                                            <input
                                                type="text"
                                                placeholder={params.org}
                                                value={newRepoOwner()}
                                                onInput={(e) => setNewRepoOwner(e.currentTarget.value)}
                                                class="w-full bg-app border border-color rounded-lg px-3 py-1.5 focus:border-blue outline-none transition-colors text-primary"
                                            />
                                        </div>
                                        <div class="flex-1">
                                            <label class="block text-xs font-medium text-muted mb-1">Repository</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. backend-api"
                                                required
                                                value={newRepoName()}
                                                onInput={(e) => setNewRepoName(e.currentTarget.value)}
                                                class="w-full bg-app border border-color rounded-lg px-3 py-1.5 focus:border-blue outline-none transition-colors text-primary"
                                            />
                                        </div>
                                        <button type="submit" class="btn btn-primary whitespace-nowrap" disabled={isSaving()}>
                                            <Plus size={14} class="mr-1" />
                                            Add Repo
                                        </button>
                                    </form>

                                    <div class="bg-panel border border-color rounded-xl overflow-hidden shadow-sm">
                                        <For each={repos()}>
                                            {(repo) => {
                                                const repoOwner = repo.owner?.login ?? params.org;
                                                return (
                                                    <div class="flex items-center justify-between p-4 border-b border-color last:border-0 hover:bg-panel-hover transition-colors">
                                                        <div class="flex items-center gap-3">
                                                            <div class="w-8 h-8 rounded-lg bg-green/10 flex items-center justify-center text-green">
                                                                <Database size={16} />
                                                            </div>
                                                            <div>
                                                                <div class="font-medium">
                                                                    <span class="text-muted">{repoOwner}/</span>{repo.name}
                                                                </div>
                                                                <Show when={repo.description}>
                                                                    <div class="text-xs text-muted mt-0.5">{repo.description}</div>
                                                                </Show>
                                                            </div>
                                                        </div>
                                                        <div class="flex items-center gap-3">
                                                            <Show when={repo.private}>
                                                                <span class="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-red/10 text-red border border-red/20">
                                                                    Private
                                                                </span>
                                                            </Show>
                                                            <button
                                                                class="text-muted hover:text-red transition-colors p-1 rounded"
                                                                onClick={() => void removeRepo(repoOwner, repo.name)}
                                                                disabled={isSaving()}
                                                                title="Remove from team"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            }}
                                        </For>
                                        <Show when={repos().length === 0}>
                                            <div class="p-8 text-center text-muted">
                                                <Database size={24} class="mx-auto mb-3 opacity-50" />
                                                <p class="m-0 text-sm">No repositories assigned to this team yet.</p>
                                            </div>
                                        </Show>
                                    </div>
                                </div>
                            </Show>

                            {/* Settings Tab */}
                            <Show when={activeTab() === "settings"}>
                                <div class="settings-section animate-in">
                                    <h2 class="text-lg font-medium mb-4">Team Settings</h2>

                                    <form class="bg-panel border border-color rounded-xl p-6 mb-6" onSubmit={updateTeam}>
                                        <div class="mb-4">
                                            <label class="block text-sm font-medium mb-1">Team Name</label>
                                            <input
                                                type="text"
                                                value={params.team}
                                                disabled
                                                class="w-full bg-app border border-color rounded-lg px-3 py-2 opacity-50 cursor-not-allowed"
                                            />
                                            <p class="text-xs text-muted mt-1">Team names cannot be changed after creation.</p>
                                        </div>
                                        <div class="mb-4">
                                            <label class="block text-sm font-medium mb-1">Description</label>
                                            <input
                                                type="text"
                                                value={editDesc()}
                                                onInput={(e) => setEditDesc(e.currentTarget.value)}
                                                class="w-full bg-app border border-color rounded-lg px-3 py-2 text-primary focus:border-blue transition-colors focus:outline-none"
                                                placeholder="What does this team do?"
                                            />
                                        </div>
                                        <div class="mb-6">
                                            <label class="block text-sm font-medium mb-1">Repository Permission</label>
                                            <select
                                                value={editPerm()}
                                                onChange={(e) => setEditPerm(e.currentTarget.value)}
                                                class="w-full bg-app border border-color rounded-lg px-3 py-2 text-primary focus:border-blue transition-colors focus:outline-none cursor-pointer"
                                            >
                                                <option value="read">Read (Clone and pull only)</option>
                                                <option value="write">Write (Push to repositories)</option>
                                                <option value="admin">Admin (Full repository access)</option>
                                            </select>
                                            <p class="text-xs text-muted mt-1">The default permission level for repositories added to this team.</p>
                                        </div>
                                        <div class="pt-4 border-t border-color flex justify-end">
                                            <button type="submit" class="btn btn-primary" disabled={isSaving()}>
                                                {isSaving() ? "Saving..." : "Save Changes"}
                                            </button>
                                        </div>
                                    </form>

                                    <div class="bg-panel border border-red/30 rounded-xl p-6">
                                        <h3 class="text-base font-medium text-red mb-2">Danger Zone</h3>
                                        <p class="text-sm text-muted mb-4">
                                            Deleting this team will remove all member and repository associations. This cannot be undone.
                                        </p>
                                        <button
                                            class="btn text-red border-red/30 hover:bg-red/10"
                                            onClick={() => void deleteTeam()}
                                            disabled={isSaving()}
                                        >
                                            <Trash2 size={14} class="mr-1.5" />
                                            Delete Team
                                        </button>
                                    </div>
                                </div>
                            </Show>
                        </Show>
                    </div>
                </div>
            </div>
        </div>
    );
}
