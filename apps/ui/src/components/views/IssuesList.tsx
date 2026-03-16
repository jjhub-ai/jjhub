import { useNavigate, useParams } from "@solidjs/router";
import { createSignal, For, onMount, Show } from "solid-js";
import {
    CheckCircle2,
    CircleDot,
    MessageSquare,
    Plus,
    Search,
    ChevronDown,
} from "lucide-solid";
import { useListNavigation, useSearchFocusTarget } from "../../lib/keyboard";
import { createHoverPrefetchHandlers } from "../../lib/prefetchCache";
import {
    issueDetailResource,
    issuesListResource,
    type IssueSummary,
} from "../../lib/navigationData";
import ShortcutBadge from "../keyboard/ShortcutBadge";
import "./IssuesList.css";

function formatRelativeTime(timestamp: string): string {
    const parsed = Date.parse(timestamp);
    if (Number.isNaN(parsed)) {
        return "recently";
    }

    const diffMs = Date.now() - parsed;
    const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
    if (diffMinutes < 60) {
        return `${diffMinutes}m ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
        return `${diffHours}h ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
}

export default function IssuesList() {
    const navigate = useNavigate();
    const params = useParams<{ owner: string; repo: string }>();
    const context = () => ({ owner: params.owner ?? "", repo: params.repo ?? "" });
    const initialIssues = issuesListResource.peek(context());
    const [filter, setFilter] = createSignal<"open" | "closed" | "all">("open");
    const [searchQuery, setSearchQuery] = createSignal("");
    const [issues, setIssues] = createSignal<IssueSummary[]>(initialIssues ?? []);
    const [isLoading, setIsLoading] = createSignal(initialIssues === undefined);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    let searchInputRef: HTMLInputElement | undefined;

    const filteredIssues = () => {
        let rows = issues();
        if (filter() !== "all") {
            rows = rows.filter((issue) => issue.state === filter());
        }
        if (searchQuery().trim()) {
            const q = searchQuery().toLowerCase();
            rows = rows.filter((issue) => {
                return (
                    issue.title.toLowerCase().includes(q) ||
                    issue.author.login.toLowerCase().includes(q) ||
                    issue.labels.some((label) => label.name.toLowerCase().includes(q))
                );
            });
        }
        return rows;
    };

    const loadIssues = async () => {
        const cachedIssues = issuesListResource.peek(context());
        if (cachedIssues) {
            setIssues(cachedIssues);
        }

        setIsLoading(!cachedIssues);
        setErrorMessage(null);

        try {
            setIssues(await issuesListResource.load(context()));
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load issues";
            setErrorMessage(message);
            setIssues([]);
        } finally {
            setIsLoading(false);
        }
    };

    onMount(() => {
        void loadIssues();
    });

    const { selectedIndex, setSelectedIndex, setItemRef, selectedItemIds, isSelected } = useListNavigation({
        items: filteredIssues,
        onOpen: (issue) => navigate(`/${context().owner}/${context().repo}/issues/${issue.number}`),
        onCreate: () => navigate(`/${context().owner}/${context().repo}/issues/new`),
        onFocusSearch: () => searchInputRef?.focus(),
        getItemId: (issue) => issue.id,
    });

    useSearchFocusTarget(() => searchInputRef?.focus());

    const getLabelColor = (label: string) => {
        const colors: Record<string, string> = {
            bug: "var(--accent-red)",
            enhancement: "var(--accent-blue)",
            feature: "var(--accent-green)",
            design: "var(--accent-purple)",
            ui: "var(--accent-cyan)",
            core: "var(--accent-yellow)",
            build: "var(--text-secondary)",
            performance: "var(--accent-yellow)",
            ai: "var(--accent-purple)",
            refactor: "var(--text-secondary)",
        };
        return colors[label] ?? "var(--text-muted)";
    };

    return (
        <div class="issues-view flex flex-col h-full w-full bg-app text-primary">
            <div class="view-header flex items-center justify-between p-6 border-b border-color flex-shrink-0 animate-in stagger-1">
                <div class="flex flex-col gap-1">
                    <h1 class="text-xl font-semibold flex items-center gap-2">
                        Issues
                        <span class="badge-count subtle">{issues().length}</span>
                    </h1>
                </div>
                <div class="header-actions flex items-center gap-3">
                    <div class="search-box relative">
                        <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search issues..."
                            class="pl-9 pr-4 py-1.5 bg-panel border border-color rounded-md text-sm focus:border-blue transition-colors focus:outline-none"
                            value={searchQuery()}
                            onInput={(event) => {
                                setSearchQuery(event.currentTarget.value);
                                setSelectedIndex(0);
                            }}
                        />
                    </div>
                    <button class="btn btn-primary flex items-center gap-2" type="button" onClick={() => navigate(`/${context().owner}/${context().repo}/issues/new`)}>
                        <Plus size={14} />
                        <span>New Issue</span>
                    </button>
                </div>
            </div>

            <div class="flex-1 overflow-hidden flex flex-col p-6 max-w-6xl mx-auto w-full">
                <div class="list-toolbar flex items-center justify-between mb-4 bg-panel border border-color rounded-t-lg p-3 animate-in stagger-2">
                    <div class="flex items-center gap-4 text-sm font-medium">
                        <button
                            class={`flex items-center gap-2 transition-colors ${filter() === "open" ? "text-primary" : "text-muted hover:text-secondary"}`}
                            onClick={() => {
                                setFilter("open");
                                setSelectedIndex(0);
                            }}
                        >
                            <CircleDot size={16} class={filter() === "open" ? "text-green" : ""} />
                            <span>{issues().filter((issue) => issue.state === "open").length} Open</span>
                        </button>
                        <button
                            class={`flex items-center gap-2 transition-colors ${filter() === "closed" ? "text-primary" : "text-muted hover:text-secondary"}`}
                            onClick={() => {
                                setFilter("closed");
                                setSelectedIndex(0);
                            }}
                        >
                            <CheckCircle2 size={16} class={filter() === "closed" ? "text-purple" : ""} />
                            <span>{issues().filter((issue) => issue.state === "closed").length} Closed</span>
                        </button>
                    </div>

                    <div class="flex items-center gap-4 text-sm text-secondary">
                        <button class="flex items-center gap-1 hover:text-primary transition-colors">
                            <span>Author</span>
                            <ChevronDown size={14} />
                        </button>
                        <button class="flex items-center gap-1 hover:text-primary transition-colors">
                            <span>Label</span>
                            <ChevronDown size={14} />
                        </button>
                        <button class="flex items-center gap-1 hover:text-primary transition-colors">
                            <span>Sort</span>
                            <ChevronDown size={14} />
                        </button>
                    </div>
                </div>

                <div
                    class="issue-list border border-t-0 border-color rounded-b-lg flex-1 overflow-y-auto bg-root animate-in stagger-3"
                    role="listbox"
                    tabindex={0}
                    aria-activedescendant={filteredIssues()[selectedIndex()] ? `issue-option-${filteredIssues()[selectedIndex()]!.id}` : undefined}
                >
                    <Show when={isLoading()}>
                        <div class="empty-state flex flex-col items-center justify-center h-48 text-muted">
                            <p>Loading issues...</p>
                        </div>
                    </Show>

                    <Show when={errorMessage() !== null}>
                        <div class="empty-state flex flex-col items-center justify-center h-48 text-red">
                            <p>{errorMessage()}</p>
                        </div>
                    </Show>

                    <Show when={!isLoading() && errorMessage() === null && filteredIssues().length === 0}>
                        <div class="empty-state flex flex-col items-center justify-center h-48 text-muted mt-8">
                            <div class="mb-4 bg-active border border-color rounded-full p-4 flex items-center justify-center opacity-70 shadow-sm">
                                <CircleDot size={24} class="text-secondary" />
                            </div>
                            <p class="font-medium text-secondary">No issues match your current filters.</p>
                            <p class="text-xs mt-1 max-w-[200px] text-center">Try another search, or switch between open and closed issues.</p>
                        </div>
                    </Show>

                    <For each={filteredIssues()}>
                        {(issue, index) => {
                            const prefetchHandlers = createHoverPrefetchHandlers(() =>
                                issueDetailResource.prefetch(context(), String(issue.number)),
                            );

                            return (
                                <div
                                    id={`issue-option-${issue.id}`}
                                    class={`issue-row flex items-start gap-3 p-4 border-b border-light hover:bg-panel-hover transition-colors cursor-pointer group ${selectedIndex() === index() ? "selected-row bg-panel-hover" : ""} ${isSelected(issue, index()) ? "keyboard-multi-selected" : ""}`}
                                    role="option"
                                    aria-selected={selectedIndex() === index()}
                                    ref={(element) => setItemRef(index(), element)}
                                    onMouseEnter={() => {
                                        setSelectedIndex(index());
                                        prefetchHandlers.onMouseEnter();
                                    }}
                                    onMouseLeave={prefetchHandlers.onMouseLeave}
                                    onClick={() =>
                                        navigate(`/${context().owner}/${context().repo}/issues/${issue.number}`)
                                    }
                                >
                                    <div class="mt-1 flex-shrink-0">
                                        <Show when={issue.state === "open"} fallback={<CheckCircle2 size={16} class="text-purple" />}>
                                            <CircleDot size={16} class="text-green" />
                                        </Show>
                                    </div>
                                    <div class="flex flex-col flex-1 min-w-0">
                                        <div class="flex items-center gap-2 mb-1 flex-wrap">
                                            <span class="font-medium text-base text-primary group-hover:text-blue transition-colors">
                                                {issue.title}
                                            </span>
                                            <For each={issue.labels}>
                                                {(label) => (
                                                    <span
                                                        class="issue-label text-xs font-medium px-2 py-0.5 rounded-full border border-light bg-panel"
                                                        style={`color: ${getLabelColor(label.name)}`}
                                                    >
                                                        {label.name}
                                                    </span>
                                                )}
                                            </For>
                                        </div>
                                        <div class="text-xs text-muted">
                                            #{issue.number} opened {formatRelativeTime(issue.created_at)} by{" "}
                                            <span class="text-secondary hover:text-primary transition-colors">{issue.author.login}</span>
                                        </div>
                                    </div>

                                    <Show when={issue.comment_count > 0}>
                                        <div class="flex items-center gap-1 text-muted text-xs flex-shrink-0 ml-4">
                                            <MessageSquare size={14} />
                                            <span>{issue.comment_count}</span>
                                        </div>
                                    </Show>

                                    <ShortcutBadge shortcutId="list.open" class={`shortcut-hint ml-2 opacity-0 transition-opacity ${selectedIndex() === index() ? "opacity-100" : ""}`} />
                                </div>
                            );
                        }}
                    </For>
                </div>

                <div class="mt-4 text-xs text-muted flex justify-center gap-4">
                    <span>
                        <ShortcutBadge shortcutId="list.next" /> / <ShortcutBadge shortcutId="list.previous" /> navigate
                    </span>
                    <span>
                        <ShortcutBadge shortcutId="list.open" /> open
                    </span>
                    <span>
                        <ShortcutBadge shortcutId="list.select" /> select
                    </span>
                    <span>
                        <ShortcutBadge shortcutId="list.search" /> search
                    </span>
                    <span>
                        <ShortcutBadge shortcutId="list.create" /> new issue
                    </span>
                    <Show when={selectedItemIds().length > 0}>
                        <span>{selectedItemIds().length} selected</span>
                    </Show>
                </div>
            </div>
        </div>
    );
}
