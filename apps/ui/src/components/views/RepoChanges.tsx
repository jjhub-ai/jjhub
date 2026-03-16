import { useParams } from "@solidjs/router";
import { createEffect, createSignal, For, Show } from "solid-js";
import { CheckCircle2, GitCommit, Hash, MessageSquare, MoreVertical, ChevronRight, ChevronDown } from "lucide-solid";
import ChangeDiffContent from "./ChangeDiffContent";
import "./RepoChanges.css";

import { ChangeResponse } from "../../types/change";
import { repoChangesResource } from "../../lib/navigationData";

function formatRelativeTime(timestamp: string): string {
    const parsed = Date.parse(timestamp);
    if (Number.isNaN(parsed)) {
        return "recently";
    }
    const minutes = Math.max(1, Math.floor((Date.now() - parsed) / 60000));
    if (minutes < 60) {
        return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours}h ago`;
    }
    return `${Math.floor(hours / 24)}d ago`;
}

const statusLabel = (change: ChangeResponse) => {
    if (change.has_conflict) return "conflict";
    if (change.is_empty) return "empty";
    return "ready";
};

const statusClass = (change: ChangeResponse) => {
    if (change.has_conflict) return "text-red bg-red-subtle";
    if (change.is_empty) return "text-muted bg-panel";
    return "text-green bg-green-subtle";
};

const ChangeRowItem = (props: {
    change: ChangeResponse;
    repoContext: { owner: string; repo: string };
}) => {
    const [expanded, setExpanded] = createSignal(false);

    const toggleExpand = () => {
        if (!document.startViewTransition) {
            setExpanded(!expanded());
            return;
        }
        document.startViewTransition(() => {
            setExpanded(!expanded());
        });
    };

    return (
        <div class="change-row-wrapper border border-border border-t-0 first:border-t rounded-t-none first:rounded-t-md last:rounded-b-md mb-0 mt-1">
            <div 
                class={`change-row interactive-row py-3 px-4 flex items-start cursor-pointer transition-all ${expanded() ? 'bg-hover' : ''}`}
                onClick={toggleExpand}
            >
                <div class="tree-connector mr-4 mt-1">
                    <div class={`node-dot ${props.change.has_conflict ? "text-red" : "text-green"}`}>
                        <div class="solid-dot"></div>
                    </div>
                </div>

                <div class="change-content flex-grow">
                    <div class="change-main flex flex-col gap-1.5">
                        <span class="change-message text-foreground font-medium text-sm">
                            {props.change.description || "(empty description)"}
                        </span>
                        <div class="change-meta flex items-center gap-3 text-xs flex-wrap text-secondary">
                            <span class={`status-badge ${statusClass(props.change)}`}>{statusLabel(props.change)}</span>
                            <span class="change-hash flex items-center gap-1 font-mono px-1.5 py-0.5 rounded cursor-copy hover:bg-active hover:text-primary transition-colors" onClick={(e) => { e.stopPropagation(); if (props.change.change_id) navigator.clipboard.writeText(props.change.change_id); }}>
                                <Hash size={12} />
                                {props.change.change_id ?? "Unknown"}
                            </span>
                            <span class="change-author flex items-center gap-1 font-semibold text-primary">
                                {props.change.author_name}
                            </span>
                            <span class="change-time">{formatRelativeTime(props.change.timestamp)}</span>
                        </div>
                    </div>
                </div>

                <div class="change-actions flex items-center gap-2 text-muted ml-4 opacity-50 hover:opacity-100 transition-opacity">
                    <button class="action-btn hover:text-foreground" title="View Diffs">
                        {expanded() ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <button class="action-btn hover:text-foreground" title="Add Comment" onClick={(e) => e.stopPropagation()}>
                        <MessageSquare size={16} />
                    </button>
                    <button class="action-btn hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical size={16} />
                    </button>
                </div>
            </div>
            <Show when={expanded()}>
                <ChangeDiffContent
                    changeId={props.change.change_id}
                    repoContext={props.repoContext}
                />
            </Show>
        </div>
    );
};

export default function RepoChanges() {
    const params = useParams<{ owner: string; repo: string }>();
    const repoContext = () => ({
        owner: params.owner ?? "",
        repo: params.repo ?? "",
    });
    const initialChanges = repoChangesResource.peek(repoContext());
    const [changes, setChanges] = createSignal<ChangeResponse[]>(initialChanges ?? []);
    const [isLoading, setIsLoading] = createSignal(initialChanges === undefined);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const repoName = () => params.repo ?? "";

    createEffect(() => {
        const context = repoContext();
        if (!context.owner || !context.repo) {
            return;
        }

        void (async () => {
            const cachedChanges = repoChangesResource.peek(context);
            if (cachedChanges) {
                setChanges(cachedChanges);
            }

            setIsLoading(!cachedChanges);
            setErrorMessage(null);
            try {
                setChanges(await repoChangesResource.load(context));
            } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to load changes";
                setErrorMessage(message);
                setChanges([]);
            } finally {
                setIsLoading(false);
            }
        })();
    });

    return (
        <div class="changes-container">
            <header class="changes-header animate-in stagger-1">
                <div class="header-title">
                    <GitCommit size={20} class="text-yellow" />
                    <h1>
                        Changes <span class="text-muted text-lg font-normal ml-2">jj log</span>
                    </h1>
                </div>
                <div class="header-actions">
                    <button class="secondary-btn">Fetch</button>
                    <button class="primary-btn">New Change</button>
                </div>
            </header>

            <div class="changes-toolbar animate-in stagger-2">
                <div class="filter-group">
                    <span class="text-muted text-sm">revset:</span>
                    <div class="revset-input-wrapper">
                        <input type="text" class="revset-input" value="all()" />
                        <kbd class="kbd">Enter</kbd>
                    </div>
                </div>
            </div>

            <div class="changes-tree-area animate-in stagger-3">
                <Show when={isLoading()}>
                    <p class="text-muted">Loading changes...</p>
                </Show>
                <Show when={errorMessage()}>
                    {(message) => <p class="text-red">{message()}</p>}
                </Show>
                
                <div class="changes-list flex flex-col">
                    <For each={changes()}>
                        {(change) => (
                            <ChangeRowItem
                                change={change}
                                repoContext={repoContext()}
                            />
                        )}
                    </For>
                </div>
            </div>

            <div class="changes-sidebar-info">
                <div class="info-card">
                    <div class="info-card-header">
                        <CheckCircle2 size={16} class="text-green" />
                        <h3>Change Stream Loaded</h3>
                    </div>
                    <p class="text-muted text-sm mt-2">
                        Loaded {changes().length} change(s) for <span class="text-primary font-mono">{repoName()}</span>.
                    </p>
                </div>
            </div>
        </div>
    );
}
