import { createEffect, createResource, createSignal, For, Show } from "solid-js";
import { useParams, A } from "@solidjs/router";
import { MapPin, Mail, Building2, Book, Star, Activity, Users, Edit2, GitCommit, LogIn, Key, HelpCircle } from "lucide-solid";
import { apiFetch, withAuthHeaders } from "../../lib/repoContext";
import "./UserProfile.css";

type UserInfo = {
    id: number;
    username: string;
    display_name?: string;
    email?: string;
    location?: string;
    blog?: string;
    company?: string;
    bio?: string;
    avatar_url?: string;
};

type ProfileRepo = {
    id: number;
    owner: string;
    full_name: string;
    name: string;
    description: string;
    is_public: boolean;
    num_stars: number;
    default_bookmark: string;
    created_at: string;
    updated_at: string;
};

type ActivityItem = {
    id: number;
    event_type: string;
    action: string;
    actor_username: string;
    target_type: string;
    target_name: string;
    summary: string;
    created_at: string;
};

type Viewer = {
    username: string;
    display_name?: string;
};

function formatRelativeTime(timestamp: string): string {
    const parsed = Date.parse(timestamp);
    if (Number.isNaN(parsed)) {
        return "recently";
    }

    const diffMs = Date.now() - parsed;
    const minutes = Math.max(1, Math.floor(diffMs / 60000));
    if (minutes < 60) {
        return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours}h ago`;
    }

    const days = Math.floor(hours / 24);
    if (days < 30) {
        return `${days}d ago`;
    }

    return new Date(parsed).toLocaleDateString();
}

function activityIcon(eventType: string) {
    switch (eventType) {
        case "auth.login":
            return LogIn;
        case "ssh_key.create":
        case "ssh_key.delete":
            return Key;
        case "repo.create":
        case "repo.fork":
        case "repo.transfer":
            return GitCommit;
        case "repo.archive":
        case "repo.unarchive":
            return Book;
        default:
            return HelpCircle;
    }
}

function sortHighlightedRepos(items: ProfileRepo[]): ProfileRepo[] {
    return [...items].sort((left, right) => {
        if (right.num_stars !== left.num_stars) {
            return right.num_stars - left.num_stars;
        }

        return Date.parse(right.updated_at) - Date.parse(left.updated_at);
    });
}

type ProfileInfo = {
    id: number;
    username: string;
    display_name?: string;
    name?: string; // Orgs use 'name' instead of 'display_name' sometimes in API
    email?: string;
    location?: string;
    blog?: string;
    company?: string;
    bio?: string;
    description?: string; // Orgs use 'description'
    avatar_url?: string;
    visibility?: string;
};

type ProfileType = "user" | "org";

export default function UserProfile() {
    const params = useParams<{ username?: string; owner?: string }>();
    const username = () => params.username ?? params.owner ?? "";

    const [profileType, setProfileType] = createSignal<ProfileType>("user");

    const fetchViewer = async (): Promise<Viewer | null> => {
        const res = await apiFetch("/api/user");
        if (!res.ok) {
            return null;
        }

        return (await res.json()) as Viewer;
    };

    const fetchProfile = async (profileUsername: string): Promise<ProfileInfo | null> => {
        // Try user first
        let res = await apiFetch(`/api/users/${profileUsername}`);
        if (res.ok) {
            setProfileType("user");
            return (await res.json()) as ProfileInfo;
        }

        if (res.status === 404) {
            // Try org fallback
            res = await apiFetch(`/api/orgs/${profileUsername}`);
            if (res.ok) {
                setProfileType("org");
                return (await res.json()) as ProfileInfo;
            }
        }

        if (res.status === 404) {
            return null;
        }
        if (!res.ok) {
            throw new Error(`Failed to load profile (${res.status})`);
        }

        return null;
    };

    const fetchActivity = async (profileUsername: string): Promise<ActivityItem[]> => {
        if (profileType() === "org") return []; // Orgs don't have activity endpoint yet

        const res = await apiFetch(`/api/users/${profileUsername}/activity`);
        if (!res.ok) {
            return [];
        }

        return (await res.json()) as ActivityItem[];
    };

    const fetchRepos = async (profileUsername: string): Promise<ProfileRepo[]> => {
        const endpoint = profileType() === "org" 
            ? `/api/orgs/${profileUsername}/repos`
            : `/api/users/${profileUsername}/repos`;
            
        const res = await apiFetch(endpoint);
        if (!res.ok) {
            return [];
        }

        const data = await res.json();
        // Org repos might have different shape, but ProfileRepo is compatible with RepoItem
        return data as ProfileRepo[];
    };

    const fetchStars = async (profileUsername: string): Promise<ProfileRepo[]> => {
        if (profileType() === "org") return [];

        const res = await apiFetch(`/api/users/${profileUsername}/starred`);
        if (!res.ok) {
            return [];
        }

        return (await res.json()) as ProfileRepo[];
    };

    const fetchMembers = async (profileUsername: string): Promise<any[]> => {
        if (profileType() === "user") return [];
        
        const res = await apiFetch(`/api/orgs/${profileUsername}/members`);
        if (!res.ok) return [];
        return (await res.json()) as any[];
    };

    const [viewer, { mutate: mutateViewer }] = createResource(fetchViewer);
    const [profile, { mutate: mutateProfile }] = createResource(username, fetchProfile);
    const [activity, { refetch: refetchActivity }] = createResource(username, fetchActivity);
    const [repos, { refetch: refetchRepos }] = createResource(username, fetchRepos);
    const [stars, { refetch: refetchStars }] = createResource(username, fetchStars);
    const [members, { refetch: refetchMembers }] = createResource(username, fetchMembers);

    const [activeTab, setActiveTab] = createSignal<"overview" | "repos" | "stars" | "members">("overview");
    const [isEditing, setIsEditing] = createSignal(false);
    const [editName, setEditName] = createSignal("");
    const [isSaving, setIsSaving] = createSignal(false);

    createEffect(() => {
        const info = profile();
        setEditName(info?.display_name ?? info?.name ?? "");
        setIsEditing(false);
        // Reset to overview when profile changes
        setActiveTab("overview");
    });

    const isCurrentUser = () => Boolean(viewer()?.username === username() && profileType() === "user");
    const isAuthenticated = () => Boolean(viewer());
    const highlightedRepos = () => sortHighlightedRepos(repos() ?? []).slice(0, 3);

    const saveProfile = async (e: Event) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const endpoint = profileType() === "org" ? `/api/orgs/${username()}` : "/api/user";
            const body = profileType() === "org" 
                ? { description: editName() } // Orgs update description usually, but name is fixed. 
                : { display_name: editName() };

            const res = await fetch(endpoint, {
                method: "PATCH",
                headers: withAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                return;
            }

            const updated = (await res.json()) as ProfileInfo;
            mutateProfile((current) => (current ? { 
                ...current, 
                display_name: updated.display_name,
                name: updated.name,
                description: updated.description 
            } : current));
            
            if (profileType() === "user") {
                mutateViewer((current) => (current ? { ...current, display_name: updated.display_name } : current));
            }
            setIsEditing(false);
        } catch (err) {
            console.error("Failed to save profile", err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleStarRepo = async (e: Event, owner: string, repoName: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isAuthenticated()) {
            return;
        }

        const res = await apiFetch(`/api/user/starred/${owner}/${repoName}`, { method: "PUT" });
        if (res.ok) {
            refetchRepos();
            refetchStars();
        }
    };

    const handleUnstarRepo = async (e: Event, owner: string, repoName: string) => {
        e.preventDefault();
        e.stopPropagation();

        const res = await apiFetch(`/api/user/starred/${owner}/${repoName}`, { method: "DELETE" });
        if (res.ok) {
            refetchRepos();
            refetchStars();
            refetchActivity();
        }
    };

    return (
        <div class="user-profile-view bg-root text-primary min-h-screen">
            <Show
                when={!profile.loading}
                fallback={
                    <div class="max-w-[1200px] mx-auto p-8 pt-[var(--topbar-height)] text-center text-muted">
                        Loading profile...
                    </div>
                }
            >
                <Show
                    when={!profile.error}
                    fallback={
                        <div class="max-w-[1200px] mx-auto p-8 pt-[var(--topbar-height)] text-center bg-panel border border-color rounded-xl mt-8">
                            <HelpCircle size={48} class="mx-auto text-muted mb-4 opacity-50" />
                            <h1 class="text-2xl font-semibold mb-2 m-0 text-primary">Unable to load profile</h1>
                            <p class="text-muted m-0">The profile for @{username()} could not be loaded right now.</p>
                        </div>
                    }
                >
                    <Show
                        when={profile()}
                        fallback={
                            <div class="max-w-[1200px] mx-auto p-8 pt-[var(--topbar-height)] text-center bg-panel border border-color rounded-xl mt-8">
                                <Users size={48} class="mx-auto text-muted mb-4 opacity-50" />
                                <h1 class="text-2xl font-semibold mb-2 m-0 text-primary">User not found</h1>
                                <p class="text-muted m-0">The user @{username()} does not exist on this instance.</p>
                            </div>
                        }
                    >
                        {(info) => (
                            <>
                                <div class="profile-nav-container border-b border-color sticky top-0 z-10 bg-root/90 backdrop-blur-md pt-[var(--topbar-height)]">
                                    <div class="max-w-[1200px] mx-auto px-8 flex items-center justify-between">
                                        <nav class="profile-tabs flex gap-2">
                                            <button
                                                class={`tab-btn flex items-center gap-2 px-3 py-3 border-b-2 font-medium ${activeTab() === "overview" ? "border-orange text-primary" : "border-transparent text-muted hover:border-color hover:text-primary"}`}
                                                onClick={() => setActiveTab("overview")}
                                            >
                                                <Activity size={16} /> Overview
                                            </button>
                                            <button
                                                class={`tab-btn flex items-center gap-2 px-3 py-3 border-b-2 font-medium ${activeTab() === "repos" ? "border-orange text-primary" : "border-transparent text-muted hover:border-color hover:text-primary"}`}
                                                onClick={() => setActiveTab("repos")}
                                            >
                                                <Book size={16} /> Repositories
                                            </button>
                                            <button
                                                class={`tab-btn flex items-center gap-2 px-3 py-3 border-b-2 font-medium ${activeTab() === "stars" ? "border-orange text-primary" : "border-transparent text-muted hover:border-color hover:text-primary"}`}
                                                onClick={() => setActiveTab("stars")}
                                            >
                                                <Star size={16} /> Stars
                                            </button>
                                            <Show when={profileType() === "org"}>
                                                <button
                                                    class={`tab-btn flex items-center gap-2 px-3 py-3 border-b-2 font-medium ${activeTab() === "members" ? "border-orange text-primary" : "border-transparent text-muted hover:border-color hover:text-primary"}`}
                                                    onClick={() => setActiveTab("members")}
                                                >
                                                    <Users size={16} /> Members
                                                </button>
                                            </Show>
                                        </nav>
                                    </div>
                                </div>

                                <div class="max-w-[1200px] mx-auto px-8 py-8 flex flex-col md:flex-row gap-8">
                                    <div class="profile-sidebar w-full md:w-1/4 flex-shrink-0">
                                        <div class="relative mb-6">
                                            <div class={`w-full aspect-square border border-color overflow-hidden flex items-center justify-center text-7xl font-bold shadow-[0_0_40px_rgba(123,147,217,0.1)] ${profileType() === "org" ? "rounded-2xl bg-gradient-to-br from-orange/20 to-red/20 text-orange/80" : "rounded-full bg-gradient-to-br from-purple/20 to-blue/20 text-blue/80"}`}>
                                                {(info().display_name || info().name || info().username).charAt(0).toUpperCase()}
                                            </div>
                                        </div>

                                        <Show
                                            when={isEditing()}
                                            fallback={
                                                <div class="mb-4">
                                                    <h1 class="text-2xl font-bold m-0 text-primary">{info().display_name || info().name || info().username}</h1>
                                                    <h2 class="text-xl font-normal m-0 text-muted">@{info().username}</h2>
                                                </div>
                                            }
                                        >
                                            <form onSubmit={saveProfile} class="mb-4 bg-panel border border-color rounded-lg p-3">
                                                <label class="block text-xs font-medium text-muted mb-1">{profileType() === "org" ? "Description" : "Display Name"}</label>
                                                <input
                                                    type="text"
                                                    value={editName()}
                                                    onInput={(e) => setEditName(e.currentTarget.value)}
                                                    class="w-full bg-app border border-color rounded px-2 py-1 mb-2 text-primary focus:border-blue outline-none"
                                                />
                                                <div class="flex gap-2">
                                                    <button type="submit" class="btn btn-primary btn-sm flex-1" disabled={isSaving()}>
                                                        Save
                                                    </button>
                                                    <button type="button" class="btn btn-sm flex-1" onClick={() => setIsEditing(false)}>
                                                        Cancel
                                                    </button>
                                                </div>
                                            </form>
                                        </Show>

                                        <Show when={isCurrentUser() && !isEditing()}>
                                            <button
                                                class="w-full py-1.5 px-3 bg-panel border border-color text-primary font-medium rounded-lg hover:bg-panel-hover transition-colors mb-4 flex items-center justify-center gap-2"
                                                onClick={() => setIsEditing(true)}
                                            >
                                                <Edit2 size={14} /> Edit profile
                                            </button>
                                        </Show>

                                        <Show when={info().bio || info().description}>
                                            <p class="text-[0.95rem] text-primary/90 mb-4">{info().bio || info().description}</p>
                                        </Show>

                                        <div class="grid grid-cols-2 gap-3 mb-5">
                                            <div class="bg-panel border border-color rounded-lg px-3 py-3">
                                                <div class="text-xs uppercase tracking-wide text-muted">Public Repos</div>
                                                <div class="text-xl font-semibold mt-1">{repos()?.length ?? 0}</div>
                                            </div>
                                            <Show when={profileType() === "user"} fallback={
                                                <div class="bg-panel border border-color rounded-lg px-3 py-3">
                                                    <div class="text-xs uppercase tracking-wide text-muted">Members</div>
                                                    <div class="text-xl font-semibold mt-1">{members()?.length ?? 0}</div>
                                                </div>
                                            }>
                                                <div class="bg-panel border border-color rounded-lg px-3 py-3">
                                                    <div class="text-xs uppercase tracking-wide text-muted">Stars</div>
                                                    <div class="text-xl font-semibold mt-1">{stars()?.length ?? 0}</div>
                                                </div>
                                            </Show>
                                        </div>

                                        <div class="profile-metadata flex flex-col gap-2 text-[0.9rem] text-muted">
                                            <Show when={info().company}>
                                                <div class="flex items-center gap-2">
                                                    <Building2 size={16} class="flex-shrink-0" />
                                                    <span class="truncate">{info().company}</span>
                                                </div>
                                            </Show>
                                            <Show when={info().location}>
                                                <div class="flex items-center gap-2">
                                                    <MapPin size={16} class="flex-shrink-0" />
                                                    <span class="truncate">{info().location}</span>
                                                </div>
                                            </Show>
                                            <Show when={info().email && (isCurrentUser() || profileType() === "org")}>
                                                <div class="flex items-center gap-2">
                                                    <Mail size={16} class="flex-shrink-0" />
                                                    <span class="truncate">{info().email}</span>
                                                </div>
                                            </Show>
                                        </div>
                                    </div>

                                    <div class="profile-content flex-1 min-w-0">
                                        <Show when={activeTab() === "overview"}>
                                            <div class="space-y-8">
                                                <Show when={profileType() === "user"}>
                                                    <section>
                                                        <h3 class="font-semibold text-lg flex items-center gap-2 mb-4">
                                                            <Activity size={18} /> Recent Activity
                                                        </h3>
                                                        <Show when={!activity.loading} fallback={<div class="flex justify-center p-12"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
                                                            <Show
                                                                when={(activity()?.length ?? 0) > 0}
                                                                fallback={
                                                                    <div class="animate-in text-center p-12 text-muted bg-panel border border-color rounded-xl">
                                                                        <Activity size={32} class="mx-auto mb-4 opacity-50" />
                                                                        <p class="m-0">This user has no recent public activity.</p>
                                                                    </div>
                                                                }
                                                            >
                                                                <div class="space-y-4">
                                                                    <For each={activity()}>
                                                                        {(entry) => {
                                                                            const Icon = activityIcon(entry.event_type);
                                                                            return (
                                                                                <div class="flex items-start gap-4 p-4 border border-color bg-panel rounded-xl">
                                                                                    <div class="w-10 h-10 rounded-full bg-root flex items-center justify-center border border-color flex-shrink-0 text-muted">
                                                                                        <Icon size={16} />
                                                                                    </div>
                                                                                    <div class="min-w-0">
                                                                                        <div class="text-sm text-primary">{entry.summary}</div>
                                                                                        <div class="text-xs text-muted mt-1">{formatRelativeTime(entry.created_at)}</div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        }}
                                                                    </For>
                                                                </div>
                                                            </Show>
                                                        </Show>
                                                    </section>
                                                </Show>

                                                <Show when={profileType() === "org" && (members()?.length ?? 0) > 0}>
                                                    <section>
                                                        <h3 class="font-semibold text-lg flex items-center gap-2 mb-4">
                                                            <Users size={18} /> Members
                                                        </h3>
                                                        <div class="flex flex-wrap gap-2">
                                                            <For each={members()?.slice(0, 10)}>
                                                                {(member) => (
                                                                    <A 
                                                                        href={`/users/${member.username}`} 
                                                                        title={member.username}
                                                                        class="w-10 h-10 rounded-lg bg-panel border border-color flex items-center justify-center hover:border-light transition-colors text-muted font-bold text-sm"
                                                                    >
                                                                        {member.username.charAt(0).toUpperCase()}
                                                                    </A>
                                                                )}
                                                            </For>
                                                            <Show when={(members()?.length ?? 0) > 10}>
                                                                <button 
                                                                    class="w-10 h-10 rounded-lg bg-panel border border-color flex items-center justify-center hover:border-light transition-colors text-muted text-xs font-medium"
                                                                    onClick={() => setActiveTab("members")}
                                                                >
                                                                    +{members()!.length - 10}
                                                                </button>
                                                            </Show>
                                                        </div>
                                                    </section>
                                                </Show>

                                                <Show when={(highlightedRepos().length ?? 0) > 0}>
                                                    <section>
                                                        <h3 class="font-semibold text-lg flex items-center gap-2 mb-4">
                                                            <Book size={18} /> Popular Repositories
                                                        </h3>
                                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <For each={highlightedRepos()}>
                                                                {(repo) => (
                                                                    <div class="p-5 border border-color bg-panel rounded-xl hover:border-light transition-colors flex flex-col h-full">
                                                                        <div class="flex items-center gap-2 mb-2">
                                                                            <Book size={16} class="text-muted" />
                                                                            <A href={`/${repo.owner}/${repo.name}`} class="font-semibold text-blue hover:underline text-lg">
                                                                                {repo.name}
                                                                            </A>
                                                                            <span class="ml-auto text-xs px-2 py-0.5 rounded-full bg-root border border-color text-muted">
                                                                                {repo.is_public ? "Public" : "Private"}
                                                                            </span>
                                                                        </div>
                                                                        <p class="text-sm text-muted mb-4 flex-1">{repo.description || "No description provided."}</p>
                                                                        <div class="flex items-center justify-between text-xs text-muted mt-auto pt-4 border-t border-color">
                                                                            <div class="flex items-center gap-3">
                                                                                <span class="flex items-center gap-1.5">
                                                                                    <Star size={14} /> {repo.num_stars}
                                                                                </span>
                                                                                <span>Updated {formatRelativeTime(repo.updated_at)}</span>
                                                                            </div>
                                                                            <Show when={isAuthenticated()}>
                                                                                <button
                                                                                    class="flex items-center gap-1 text-muted hover:text-orange transition-colors bg-transparent border border-color rounded px-2 py-0.5"
                                                                                    onClick={(e) => handleStarRepo(e, repo.owner, repo.name)}
                                                                                >
                                                                                    <Star size={12} /> Star
                                                                                </button>
                                                                            </Show>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </For>
                                                        </div>
                                                    </section>
                                                </Show>
                                            </div>
                                        </Show>

                                        <Show when={activeTab() === "repos"}>
                                            <Show when={!repos.loading} fallback={<div class="flex justify-center p-12"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
                                                <Show
                                                    when={(repos()?.length ?? 0) > 0}
                                                    fallback={
                                                        <div class="animate-in text-center p-12 text-muted bg-panel border border-color rounded-xl">
                                                            <Book size={32} class="mx-auto mb-4 opacity-50" />
                                                            <p class="m-0">This user doesn&apos;t have any public repositories.</p>
                                                        </div>
                                                    }
                                                >
                                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <For each={repos()}>
                                                            {(repo) => (
                                                                <div class="p-6 border border-color bg-panel rounded-xl hover:border-light transition-colors flex flex-col h-full">
                                                                    <div class="flex items-center gap-2 mb-2">
                                                                        <Book size={16} class="text-muted" />
                                                                        <A href={`/${repo.owner}/${repo.name}`} class="font-semibold text-blue hover:underline text-lg">
                                                                            {repo.name}
                                                                        </A>
                                                                        <span class="ml-auto text-xs px-2 py-0.5 rounded-full bg-root border border-color text-muted">
                                                                            {repo.is_public ? "Public" : "Private"}
                                                                        </span>
                                                                    </div>
                                                                    <p class="text-sm text-muted mb-4 flex-1">{repo.description || "No description provided."}</p>
                                                                    <div class="flex items-center gap-4 text-xs text-muted mt-auto pt-4 border-t border-color justify-between">
                                                                        <div class="flex items-center gap-3">
                                                                            <span class="flex items-center gap-1.5"><Star size={14} /> {repo.num_stars}</span>
                                                                            <span>Updated {formatRelativeTime(repo.updated_at)}</span>
                                                                        </div>
                                                                        <Show when={isAuthenticated()}>
                                                                            <button
                                                                                class="flex items-center gap-1 text-muted hover:text-orange transition-colors bg-transparent border border-color rounded px-2 py-0.5"
                                                                                onClick={(e) => handleStarRepo(e, repo.owner, repo.name)}
                                                                            >
                                                                                <Star size={12} /> Star
                                                                            </button>
                                                                        </Show>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </For>
                                                    </div>
                                                </Show>
                                            </Show>
                                        </Show>

                                        <Show when={activeTab() === "stars"}>
                                            <Show when={!stars.loading} fallback={<div class="flex justify-center p-12"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
                                                <Show
                                                    when={(stars()?.length ?? 0) > 0}
                                                    fallback={
                                                        <div class="animate-in text-center p-12 text-muted bg-panel border border-color rounded-xl">
                                                            <Star size={32} class="mx-auto mb-4 opacity-50" />
                                                            <p class="m-0">This user hasn&apos;t starred any repositories yet.</p>
                                                        </div>
                                                    }
                                                >
                                                    <div class="grid grid-cols-1 gap-4">
                                                        <For each={stars()}>
                                                            {(repo) => (
                                                                <div class="p-4 border border-color bg-panel rounded-xl hover:border-light transition-colors flex flex-col h-full">
                                                                    <div class="flex items-center gap-2 mb-2">
                                                                        <Book size={16} class="text-muted" />
                                                                        <A href={`/${repo.owner}/${repo.name}`} class="font-semibold text-blue hover:underline text-lg">
                                                                            {repo.full_name}
                                                                        </A>
                                                                    </div>
                                                                    <p class="text-sm text-muted mb-4 flex-1">{repo.description || "No description provided."}</p>
                                                                    <div class="flex items-center gap-4 text-xs text-muted mt-auto pt-4 border-t border-color justify-between">
                                                                        <div class="flex items-center gap-3">
                                                                            <span class="flex items-center gap-1.5"><Star size={14} /> {repo.num_stars}</span>
                                                                            <span>Updated {formatRelativeTime(repo.updated_at)}</span>
                                                                        </div>
                                                                        <Show when={isCurrentUser()}>
                                                                            <button
                                                                                class="flex items-center gap-1 text-orange hover:text-red transition-colors bg-transparent border border-color rounded px-2 py-0.5"
                                                                                onClick={(e) => handleUnstarRepo(e, repo.owner, repo.name)}
                                                                            >
                                                                                <Star size={12} class="fill-orange" /> Unstar
                                                                            </button>
                                                                        </Show>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </For>
                                                    </div>
                                                </Show>
                                            </Show>
                                        </Show>

                                        <Show when={activeTab() === "members"}>
                                            <Show when={!members.loading} fallback={<div class="flex justify-center p-12"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
                                                <Show
                                                    when={(members()?.length ?? 0) > 0}
                                                    fallback={
                                                        <div class="animate-in text-center p-12 text-muted bg-panel border border-color rounded-xl">
                                                            <Users size={32} class="mx-auto mb-4 opacity-50" />
                                                            <p class="m-0">This organization has no members.</p>
                                                        </div>
                                                    }
                                                >
                                                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        <For each={members()}>
                                                            {(member) => (
                                                                <A 
                                                                    href={`/users/${member.username}`}
                                                                    class="p-4 border border-color bg-panel rounded-xl hover:border-light transition-colors flex items-center gap-3"
                                                                >
                                                                    <div class="w-10 h-10 rounded-full bg-root border border-color flex items-center justify-center text-muted font-bold">
                                                                        {member.username.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div class="min-w-0">
                                                                        <div class="font-semibold text-primary truncate">{member.display_name || member.username}</div>
                                                                        <div class="text-xs text-muted truncate">@{member.username}</div>
                                                                    </div>
                                                                </A>
                                                            )}
                                                        </For>
                                                    </div>
                                                </Show>
                                            </Show>
                                        </Show>
                                    </div>
                                </div>
                            </>
                        )}
                    </Show>
                </Show>
            </Show>
        </div>
    );
}
