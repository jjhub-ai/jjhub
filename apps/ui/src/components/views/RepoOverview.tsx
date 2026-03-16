import { createResource, createSignal, For, Show, createMemo, createEffect } from "solid-js";
import { useParams, A } from "@solidjs/router";
import { 
    Book, Star, Eye, GitFork, Copy, Check, 
    FileText, Folder, Github, Terminal, 
    Info, Activity, Clock, Shield, Globe, Lock
} from "lucide-solid";
import MarkdownIt from 'markdown-it';
import { apiFetch, repoApiFetch } from "../../lib/repoContext";
import "./RepoOverview.css";

const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
});

type RepoMetadata = {
    id: number;
    owner: string;
    name: string;
    full_name: string;
    description: string;
    is_public: boolean;
    is_archived: boolean;
    num_stars: number;
    num_watchers: number;
    num_forks: number;
    default_branch: string;
    created_at: string;
    updated_at: string;
};

type ContentEntry = {
    name: string;
    path: string;
    type: 'file' | 'dir';
    size: number;
};

function formatRelativeTime(timestamp: string): string {
    const parsed = Date.parse(timestamp);
    if (Number.isNaN(parsed)) return "recently";
    const diffMs = Date.now() - parsed;
    const minutes = Math.max(1, Math.floor(diffMs / 60000));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(parsed).toLocaleDateString();
}

export default function RepoOverview() {
    const params = useParams<{ owner: string; repo: string }>();
    const ctx = () => ({ owner: params.owner, repo: params.repo });

    const [copied, setCopied] = createSignal(false);
    const [cloneType, setCloneType] = createSignal<"https" | "ssh">("https");

    const fetchRepo = async (): Promise<RepoMetadata | null> => {
        const res = await apiFetch(`/api/repos/${params.owner}/${params.repo}`);
        if (!res.ok) return null;
        return (await res.json()) as RepoMetadata;
    };

    const fetchRootContents = async (): Promise<ContentEntry[]> => {
        const res = await repoApiFetch("/contents", {}, ctx());
        if (!res.ok) return [];
        return (await res.json()) as ContentEntry[];
    };

    const [repo] = createResource(fetchRepo);
    const [contents] = createResource(fetchRootContents);
    const [readmeContent, setReadmeContent] = createSignal<string | null>(null);

    createEffect(async () => {
        const entries = contents();
        if (!entries) return;

        const readme = entries.find(e => e.name.toLowerCase() === "readme.md");
        if (readme) {
            const res = await repoApiFetch(`/contents/${readme.path}`, {}, ctx());
            if (res.ok) {
                const data = await res.json();
                const content = data.encoding === "base64" ? atob(data.content) : data.content;
                setReadmeContent(content);
            }
        }
    });

    const copyCloneUrl = () => {
        const url = cloneUrl();
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const cloneUrl = () => {
        const host = window.location.host;
        if (cloneType() === "https") {
            return `https://${host}/${params.owner}/${params.repo}.git`;
        }
        return `jj@${host}:${params.owner}/${params.repo}`;
    };

    const sortedEntries = createMemo(() => {
        const items = contents() ?? [];
        return [...items].sort((a, b) => {
            if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
            return a.name.localeCompare(b.name);
        }).slice(0, 10);
    });

    return (
        <div class="repo-overview-view">
            <Show when={!repo.loading} fallback={<div class="p-12 text-center text-muted">Loading repository...</div>}>
                <Show when={repo()} fallback={<div class="p-12 text-center text-muted">Repository not found</div>}>
                    {(info) => (
                        <div class="max-w-[1200px] mx-auto p-8 pt-6">
                            <header class="repo-header flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                                <div class="flex-1">
                                    <div class="flex items-center gap-2 mb-2">
                                        <A href={`/${info().owner}`} class="text-blue hover:underline text-xl">
                                            {info().owner}
                                        </A>
                                        <span class="text-muted text-xl">/</span>
                                        <h1 class="text-2xl font-bold m-0 text-primary">{info().name}</h1>
                                        <span class={`ml-2 px-2 py-0.5 rounded-full border text-[11px] font-semibold uppercase tracking-wider ${info().is_public ? 'bg-green/10 border-green/20 text-green' : 'bg-red/10 border-red/20 text-red'}`}>
                                            {info().is_public ? 'Public' : 'Private'}
                                        </span>
                                        <Show when={info().is_archived}>
                                            <span class="px-2 py-0.5 rounded-full border border-orange/20 bg-orange/10 text-orange text-[11px] font-semibold uppercase tracking-wider">
                                                Archived
                                            </span>
                                        </Show>
                                    </div>
                                    <p class="text-muted text-lg max-w-2xl m-0">{info().description || "No description provided."}</p>
                                </div>

                                <div class="flex items-center gap-2">
                                    <div class="repo-stat-badge">
                                        <Eye size={14} />
                                        <span>Watch</span>
                                        <span class="count">{info().num_watchers}</span>
                                    </div>
                                    <div class="repo-stat-badge">
                                        <GitFork size={14} />
                                        <span>Fork</span>
                                        <span class="count">{info().num_forks}</span>
                                    </div>
                                    <div class="repo-stat-badge highlight">
                                        <Star size={14} />
                                        <span>Star</span>
                                        <span class="count">{info().num_stars}</span>
                                    </div>
                                </div>
                            </header>

                            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div class="lg:col-span-2 space-y-8">
                                    <section class="card overflow-hidden">
                                        <div class="card-header flex items-center justify-between px-4 py-3 bg-panel border-b border-color">
                                            <div class="flex items-center gap-4">
                                                <div class="flex items-center gap-2 text-sm font-medium">
                                                    <Clock size={16} class="text-muted" />
                                                    <span>Updated {formatRelativeTime(info().updated_at)}</span>
                                                </div>
                                            </div>
                                            <A href={`/${info().owner}/${info().name}/code`} class="text-sm font-semibold text-blue hover:underline">
                                                Browse all files
                                            </A>
                                        </div>
                                        <div class="file-list">
                                            <For each={sortedEntries()}>
                                                {(entry) => (
                                                    <div class="file-row flex items-center justify-between px-4 py-2 border-b border-color last:border-0 hover:bg-panel-hover transition-colors">
                                                        <div class="flex items-center gap-3">
                                                            <Show when={entry.type === 'dir'} fallback={<FileText size={16} class="text-muted" />}>
                                                                <Folder size={16} class="text-blue" />
                                                            </Show>
                                                            <A href={`/${info().owner}/${info().name}/code?path=${entry.path}`} class="text-primary hover:text-blue hover:underline">
                                                                {entry.name}
                                                            </A>
                                                        </div>
                                                        <span class="text-xs text-muted font-mono">{entry.type === 'file' ? `${(entry.size / 1024).toFixed(1)} KB` : ''}</span>
                                                    </div>
                                                )}
                                            </For>
                                        </div>
                                    </section>

                                    <Show when={readmeContent()}>
                                        <section class="card readme-card">
                                            <div class="card-header px-4 py-3 bg-panel border-b border-color flex items-center gap-2">
                                                <FileText size={16} class="text-muted" />
                                                <span class="font-semibold text-sm">README.md</span>
                                            </div>
                                            <div class="p-8 prose prose-invert max-w-none readme-content" innerHTML={md.render(readmeContent()!)} />
                                        </section>
                                    </Show>
                                </div>

                                <div class="space-y-6">
                                    <section class="card p-6">
                                        <h3 class="text-sm font-bold uppercase tracking-wider text-muted mb-4">Clone Repository</h3>
                                        <div class="flex gap-1 mb-3">
                                            <button 
                                                class={`px-3 py-1 text-xs font-semibold rounded ${cloneType() === "https" ? "bg-blue text-white" : "bg-panel text-muted hover:text-primary"}`}
                                                onClick={() => setCloneType("https")}
                                            >HTTPS</button>
                                            <button 
                                                class={`px-3 py-1 text-xs font-semibold rounded ${cloneType() === "ssh" ? "bg-blue text-white" : "bg-panel text-muted hover:text-primary"}`}
                                                onClick={() => setCloneType("ssh")}
                                            >SSH</button>
                                        </div>
                                        <div class="flex items-stretch gap-0 border border-color rounded-lg overflow-hidden bg-app">
                                            <div class="flex-1 px-3 py-2 text-sm font-mono truncate text-primary/80">
                                                {cloneUrl()}
                                            </div>
                                            <button 
                                                class="px-3 bg-panel border-l border-color hover:bg-panel-hover text-muted hover:text-primary transition-colors"
                                                onClick={copyCloneUrl}
                                                title="Copy to clipboard"
                                            >
                                                <Show when={copied()} fallback={<Copy size={16} />}>
                                                    <Check size={16} class="text-green" />
                                                </Show>
                                            </button>
                                        </div>
                                        <p class="text-[11px] text-muted mt-3 flex items-center gap-1">
                                            <Terminal size={12} />
                                            <span>Use `jj clone {cloneUrl()}` to get started.</span>
                                        </p>
                                    </section>

                                    <section class="card p-6">
                                        <h3 class="text-sm font-bold uppercase tracking-wider text-muted mb-4">About</h3>
                                        <div class="space-y-4">
                                            <div class="flex items-center gap-3 text-sm">
                                                <Activity size={16} class="text-muted" />
                                                <span>Default branch: <span class="font-mono bg-panel px-1.5 py-0.5 rounded text-xs">{info().default_branch}</span></span>
                                            </div>
                                            <div class="flex items-center gap-3 text-sm">
                                                <Info size={16} class="text-muted" />
                                                <span>Repository ID: <span class="text-muted">{info().id}</span></span>
                                            </div>
                                            <div class="flex items-center gap-3 text-sm">
                                                <Globe size={16} class="text-muted" />
                                                <span>{info().is_public ? "Public visibility" : "Private repository"}</span>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </div>
                    )}
                </Show>
            </Show>
        </div>
    );
}
