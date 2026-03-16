import { createSignal, onMount, For, Show } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import { Settings, Users, Shield, Plus, Trash2, CheckCircle2, Building2, Database, ChevronRight } from "lucide-solid";
import { withAuthHeaders } from "../../lib/repoContext";
import "./OrgSettings.css";

type OrgInfo = {
    name: string;
    description: string;
    visibility: string;
    location: string;
};

type OrgMember = {
    id: number;
    username: string;
    display_name: string;
    avatar_url: string;
    role: string;
};

type OrgTeam = {
    id: number;
    name: string;
    description: string;
    permission: string;
};

type OrgRepo = {
    id: number;
    name: string;
    full_name: string;
    description: string;
    private: boolean;
    owner: { login: string };
};

export default function OrgSettings() {
    const params = useParams<{ org: string }>();
    const navigate = useNavigate();
    const props = { get org() { return params.org; } };

    const [activeTab, setActiveTab] = createSignal<"general" | "members" | "teams" | "repos">("general");
    const [isLoading, setIsLoading] = createSignal(true);
    const [isSaving, setIsSaving] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [successMessage, setSuccessMessage] = createSignal<string | null>(null);

    // Data states
    const [orgInfo, setOrgInfo] = createSignal<OrgInfo | null>(null);
    const [members, setMembers] = createSignal<OrgMember[]>([]);
    const [teams, setTeams] = createSignal<OrgTeam[]>([]);
    const [repos, setRepos] = createSignal<OrgRepo[]>([]);

    // Form states
    const [editDescription, setEditDescription] = createSignal("");
    const [editVisibility, setEditVisibility] = createSignal("public");
    const [editLocation, setEditLocation] = createSignal("");

    // Member form
    const [newMemberUsername, setNewMemberUsername] = createSignal("");
    const [newMemberRole, setNewMemberRole] = createSignal("member");

    // Team form
    const [isCreatingTeam, setIsCreatingTeam] = createSignal(false);
    const [newTeamName, setNewTeamName] = createSignal("");
    const [newTeamDesc, setNewTeamDesc] = createSignal("");
    const [newTeamPerm, setNewTeamPerm] = createSignal("read");

    const showSuccess = (msg: string) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    const loadData = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const [orgRes, membersRes, teamsRes, reposRes] = await Promise.all([
                fetch(`/api/orgs/${props.org}`, { headers: withAuthHeaders() }),
                fetch(`/api/orgs/${props.org}/members`, { headers: withAuthHeaders() }),
                fetch(`/api/orgs/${props.org}/teams`, { headers: withAuthHeaders() }),
                fetch(`/api/orgs/${props.org}/repos`, { headers: withAuthHeaders() }),
            ]);

            if (orgRes.ok) {
                const info = await orgRes.json() as OrgInfo;
                setOrgInfo(info);
                setEditDescription(info.description || "");
                setEditVisibility(info.visibility || "public");
                setEditLocation(info.location || "");
            }
            if (membersRes.ok) {
                setMembers(await membersRes.json());
            }
            if (teamsRes.ok) {
                setTeams(await teamsRes.json());
            }
            if (reposRes.ok) {
                setRepos(await reposRes.json());
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    onMount(() => void loadData());

    const updateGeneral = async (e: Event) => {
        e.preventDefault();
        setIsSaving(true);
        setErrorMessage(null);
        setSuccessMessage(null);
        try {
            const res = await fetch(`/api/orgs/${props.org}`, {
                method: "PATCH",
                headers: withAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({
                    description: editDescription(),
                    visibility: editVisibility(),
                    location: editLocation(),
                })
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error((body as { message?: string })?.message ?? "Failed to update organization");
            }
            showSuccess("Organization updated successfully");
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    };

    const addMember = async (e: Event) => {
        e.preventDefault();
        if (!newMemberUsername()) return;
        setIsSaving(true);
        setErrorMessage(null);
        try {
            // First lookup the user ID
            const userRes = await fetch(`/api/users/${newMemberUsername()}`, { headers: withAuthHeaders() });
            if (!userRes.ok) throw new Error("User not found");
            const userData = await userRes.json();

            // Then add to org
            const addRes = await fetch(`/api/orgs/${props.org}/members`, {
                method: "POST",
                headers: withAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ user_id: userData.id, role: newMemberRole() })
            });
            if (!addRes.ok) {
                const body = await addRes.json().catch(() => null);
                throw new Error((body as { message?: string })?.message ?? "Failed to add member");
            }

            setNewMemberUsername("");
            showSuccess(`Added ${userData.username || newMemberUsername()} to the organization`);
            void loadData();
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    };

    const changeMemberRole = async (username: string, currentRole: string) => {
        const newRole = currentRole === "admin" ? "member" : "admin";
        if (!confirm(`Change ${username}'s role from ${currentRole} to ${newRole}?`)) return;
        setIsSaving(true);
        setErrorMessage(null);
        try {
            // Look up user ID first
            const userRes = await fetch(`/api/users/${username}`, { headers: withAuthHeaders() });
            if (!userRes.ok) throw new Error("User not found");
            const userData = await userRes.json();

            // Re-add with new role (the API handles role updates via POST)
            const res = await fetch(`/api/orgs/${props.org}/members`, {
                method: "POST",
                headers: withAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ user_id: userData.id, role: newRole })
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error((body as { message?: string })?.message ?? "Failed to change role");
            }
            showSuccess(`Changed ${username}'s role to ${newRole}`);
            void loadData();
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    };

    const removeMember = async (username: string) => {
        if (!confirm(`Remove ${username} from ${props.org}?`)) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/orgs/${props.org}/members/${username}`, {
                method: "DELETE",
                headers: withAuthHeaders()
            });
            if (!res.ok) throw new Error("Failed to remove member");
            setMembers(members().filter(m => m.username !== username));
            showSuccess(`Removed ${username} from the organization`);
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    };

    const createTeam = async (e: Event) => {
        e.preventDefault();
        if (!newTeamName()) return;
        setIsSaving(true);
        setErrorMessage(null);
        try {
            const res = await fetch(`/api/orgs/${props.org}/teams`, {
                method: "POST",
                headers: withAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({
                    name: newTeamName(),
                    description: newTeamDesc(),
                    permission: newTeamPerm()
                })
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error((body as { message?: string })?.message ?? "Failed to create team");
            }

            setIsCreatingTeam(false);
            setNewTeamName("");
            setNewTeamDesc("");
            showSuccess("Team created successfully");
            void loadData();
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    };

    const deleteTeam = async (name: string) => {
        if (!confirm(`Delete team ${name}?`)) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/orgs/${props.org}/teams/${name}`, {
                method: "DELETE",
                headers: withAuthHeaders()
            });
            if (!res.ok) throw new Error("Failed to delete team");
            setTeams(teams().filter(t => t.name !== name));
            showSuccess("Team deleted");
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div class="org-settings-view bg-root text-primary min-h-full">
            <div class="max-w-5xl mx-auto w-full p-8 pb-32">
                <header class="settings-header flex items-center gap-4 mb-8 pb-6 border-b border-color">
                    <div class="org-avatar w-12 h-12 rounded-xl bg-purple/10 border border-purple/20 flex items-center justify-center text-purple text-xl font-bold">
                        {props.org.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h1 class="text-2xl font-semibold m-0">{props.org}</h1>
                        <p class="text-muted m-0 text-sm mt-1">Organization Settings</p>
                    </div>
                </header>

                <div class="flex flex-col md:flex-row gap-8">
                    <nav class="settings-nav w-full md:w-64 flex-shrink-0 flex flex-col gap-1">
                        <button
                            class={`nav-tab border border-transparent ${activeTab() === 'general' ? 'active shadow-sm' : 'hover:bg-panel-hover'}`}
                            onClick={() => setActiveTab('general')}
                        >
                            <Settings size={16} />
                            General
                        </button>
                        <button
                            class={`nav-tab border border-transparent ${activeTab() === 'members' ? 'active shadow-sm' : 'hover:bg-panel-hover'}`}
                            onClick={() => setActiveTab('members')}
                        >
                            <Users size={16} />
                            Members
                            <span class="badge ml-auto">{members().length || 0}</span>
                        </button>
                        <button
                            class={`nav-tab border border-transparent ${activeTab() === 'teams' ? 'active shadow-sm' : 'hover:bg-panel-hover'}`}
                            onClick={() => setActiveTab('teams')}
                        >
                            <Shield size={16} />
                            Teams
                            <span class="badge ml-auto">{teams().length || 0}</span>
                        </button>
                        <button
                            class={`nav-tab border border-transparent ${activeTab() === 'repos' ? 'active shadow-sm' : 'hover:bg-panel-hover'}`}
                            onClick={() => setActiveTab('repos')}
                        >
                            <Database size={16} />
                            Repositories
                            <span class="badge ml-auto">{repos().length || 0}</span>
                        </button>
                    </nav>

                    <div class="settings-content flex-1 min-w-0">
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

                        <Show when={isLoading()}>
                            <div class="p-8 text-center text-muted border border-color rounded-xl bg-panel">
                                Loading organization data...
                            </div>
                        </Show>

                        <Show when={!isLoading()}>
                            {/* General Tab */}
                            <Show when={activeTab() === 'general'}>
                                <div class="settings-section animate-in">
                                    <h2 class="text-lg font-medium mb-4">Organization Profile</h2>
                                    <form class="bg-panel border border-color rounded-xl p-6" onSubmit={updateGeneral}>
                                        <div class="form-group mb-4">
                                            <label class="block text-sm font-medium mb-1">Organization Name</label>
                                            <input type="text" value={props.org} disabled class="w-full bg-app border border-color rounded-lg px-3 py-2 opacity-50 cursor-not-allowed" />
                                            <p class="text-xs text-muted mt-1">Organization names cannot be changed currently.</p>
                                        </div>
                                        <div class="form-group mb-4">
                                            <label class="block text-sm font-medium mb-1">Description</label>
                                            <input
                                                type="text"
                                                value={editDescription()}
                                                onInput={(e) => setEditDescription(e.currentTarget.value)}
                                                class="w-full bg-app border border-color rounded-lg px-3 py-2 text-primary focus:border-blue transition-colors focus:outline-none"
                                                placeholder="What is this organization for?"
                                            />
                                        </div>
                                        <div class="form-group mb-4">
                                            <label class="block text-sm font-medium mb-1">Visibility</label>
                                            <select
                                                value={editVisibility()}
                                                onChange={(e) => setEditVisibility(e.currentTarget.value)}
                                                class="w-full bg-app border border-color rounded-lg px-3 py-2 text-primary focus:border-blue transition-colors focus:outline-none cursor-pointer"
                                            >
                                                <option value="public">Public</option>
                                                <option value="private">Private</option>
                                            </select>
                                        </div>
                                        <div class="form-group mb-6">
                                            <label class="block text-sm font-medium mb-1">
                                                Location <span class="text-muted font-normal text-xs ml-1">(Optional)</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={editLocation()}
                                                onInput={(e) => setEditLocation(e.currentTarget.value)}
                                                class="w-full bg-app border border-color rounded-lg px-3 py-2 text-primary focus:border-blue transition-colors focus:outline-none"
                                                placeholder="e.g. San Francisco, CA"
                                            />
                                        </div>
                                        <div class="pt-4 border-t border-color flex justify-end">
                                            <button type="submit" class="btn btn-primary" disabled={isSaving()}>
                                                {isSaving() ? "Saving..." : "Save Changes"}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </Show>

                            {/* Members Tab */}
                            <Show when={activeTab() === 'members'}>
                                <div class="settings-section animate-in">
                                    <div class="flex items-center justify-between mb-4">
                                        <h2 class="text-lg font-medium m-0">Members</h2>
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
                                        <div class="w-32">
                                            <label class="block text-xs font-medium text-muted mb-1">Role</label>
                                            <select
                                                value={newMemberRole()}
                                                onChange={(e) => setNewMemberRole(e.currentTarget.value)}
                                                class="w-full bg-app border border-color rounded-lg px-3 py-1.5 focus:border-blue outline-none transition-colors text-primary cursor-pointer"
                                            >
                                                <option value="member">Member</option>
                                                <option value="admin">Admin</option>
                                                <option value="owner">Owner</option>
                                            </select>
                                        </div>
                                        <button type="submit" class="btn btn-primary whitespace-nowrap" disabled={isSaving()}>
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
                                                    <div class="flex items-center gap-3">
                                                        <button
                                                            class={`text-[11px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                                                                member.role === 'owner'
                                                                    ? 'bg-yellow/10 text-yellow border border-yellow/20'
                                                                    : member.role === 'admin'
                                                                    ? 'bg-purple/10 text-purple border border-purple/20 hover:bg-purple/20'
                                                                    : 'bg-green/10 text-green border border-green/20 hover:bg-green/20'
                                                            }`}
                                                            onClick={() => member.role !== 'owner' && void changeMemberRole(member.username, member.role)}
                                                            disabled={isSaving() || member.role === 'owner'}
                                                            title={member.role === 'owner' ? 'Owner role cannot be changed' : `Click to change role (currently ${member.role})`}
                                                        >
                                                            {member.role}
                                                        </button>
                                                        <button
                                                            class="text-muted hover:text-red transition-colors p-1 rounded"
                                                            onClick={() => void removeMember(member.username)}
                                                            disabled={isSaving() || member.role === 'owner'}
                                                            title={member.role === 'owner' ? 'Cannot remove owner' : 'Remove member'}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                        <Show when={members().length === 0}>
                                            <div class="p-8 text-center text-muted">No members found.</div>
                                        </Show>
                                    </div>
                                </div>
                            </Show>

                            {/* Teams Tab */}
                            <Show when={activeTab() === 'teams'}>
                                <div class="settings-section animate-in">
                                    <div class="flex items-center justify-between mb-4">
                                        <h2 class="text-lg font-medium m-0">Teams</h2>
                                        <div class="flex items-center gap-2">
                                            <button
                                                class="btn btn-sm flex items-center gap-1.5"
                                                onClick={() => navigate(`/orgs/${props.org}/teams`)}
                                            >
                                                Manage all teams
                                                <ChevronRight size={14} />
                                            </button>
                                            <Show when={!isCreatingTeam()}>
                                                <button class="btn btn-primary btn-sm flex items-center gap-1.5" onClick={() => setIsCreatingTeam(true)}>
                                                    <Plus size={14} /> New Team
                                                </button>
                                            </Show>
                                        </div>
                                    </div>

                                    <Show when={isCreatingTeam()}>
                                        <form class="bg-panel border border-blue shadow-[0_0_0_1px_rgba(123,147,217,0.3)] rounded-xl p-5 mb-6" onSubmit={createTeam}>
                                            <h3 class="font-medium mb-4 flex items-center gap-2">
                                                <Shield size={16} class="text-blue" />
                                                Create a new team
                                            </h3>
                                            <div class="grid gap-4 mb-4">
                                                <div>
                                                    <label class="block text-sm text-muted mb-1">Team Name</label>
                                                    <input type="text" required value={newTeamName()} onInput={e => setNewTeamName(e.currentTarget.value)} class="w-full bg-app border border-color rounded-lg px-3 py-1.5 outline-none focus:border-blue text-primary" placeholder="e.g. backend-engineers" />
                                                </div>
                                                <div>
                                                    <label class="block text-sm text-muted mb-1">Description</label>
                                                    <input type="text" value={newTeamDesc()} onInput={e => setNewTeamDesc(e.currentTarget.value)} class="w-full bg-app border border-color rounded-lg px-3 py-1.5 outline-none focus:border-blue text-primary" placeholder="What does this team do?" />
                                                </div>
                                                <div>
                                                    <label class="block text-sm text-muted mb-1">Default Repository Permission</label>
                                                    <select value={newTeamPerm()} onChange={e => setNewTeamPerm(e.currentTarget.value)} class="w-full bg-app border border-color rounded-lg px-3 py-1.5 outline-none focus:border-blue cursor-pointer text-primary">
                                                        <option value="read">Read (Clone and pull only)</option>
                                                        <option value="write">Write (Push to repositories)</option>
                                                        <option value="admin">Admin (Full repository access)</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div class="flex justify-end gap-2 pt-4 border-t border-color mt-4">
                                                <button type="button" class="btn" onClick={() => setIsCreatingTeam(false)}>Cancel</button>
                                                <button type="submit" class="btn btn-primary" disabled={isSaving()}>Create Team</button>
                                            </div>
                                        </form>
                                    </Show>

                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <For each={teams()}>
                                            {(team) => (
                                                <div class="bg-panel border border-color rounded-xl p-5 shadow-sm group hover:border-blue/40 transition-colors flex flex-col">
                                                    <div class="flex items-start justify-between mb-2">
                                                        <h3
                                                            class="font-medium text-lg m-0 flex items-center gap-2 cursor-pointer hover:text-blue transition-colors"
                                                            onClick={() => navigate(`/orgs/${props.org}/teams/${team.name}`)}
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
                                                            onClick={() => navigate(`/orgs/${props.org}/teams/${team.name}`)}
                                                        >
                                                            Manage team
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                        <Show when={teams().length === 0 && !isCreatingTeam()}>
                                            <div class="col-span-full p-8 text-center bg-panel border-dashed border border-color rounded-xl text-muted">
                                                <Building2 size={24} class="mx-auto mb-3 opacity-50" />
                                                <p class="m-0 text-sm">You haven't created any teams yet.</p>
                                                <button class="text-blue mt-2 text-sm hover:underline" onClick={() => setIsCreatingTeam(true)}>Create your first team</button>
                                            </div>
                                        </Show>
                                    </div>
                                </div>
                            </Show>

                            {/* Repos Tab */}
                            <Show when={activeTab() === 'repos'}>
                                <div class="settings-section animate-in">
                                    <div class="flex items-center justify-between mb-4">
                                        <h2 class="text-lg font-medium m-0">Repositories</h2>
                                    </div>

                                    <div class="bg-panel border border-color rounded-xl overflow-hidden shadow-sm">
                                        <For each={repos()}>
                                            {(repo) => {
                                                const repoOwner = repo.owner?.login ?? props.org;
                                                return (
                                                    <div
                                                        class="flex items-center justify-between p-4 border-b border-color last:border-0 hover:bg-panel-hover transition-colors cursor-pointer"
                                                        onClick={() => navigate(`/${repoOwner}/${repo.name}/code`)}
                                                    >
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
                                                            <ChevronRight size={16} class="text-muted" />
                                                        </div>
                                                    </div>
                                                );
                                            }}
                                        </For>
                                        <Show when={repos().length === 0}>
                                            <div class="p-8 text-center text-muted">
                                                <Database size={24} class="mx-auto mb-3 opacity-50" />
                                                <p class="m-0 text-sm">No repositories in this organization yet.</p>
                                            </div>
                                        </Show>
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
