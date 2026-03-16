import { useNavigate, useParams } from "@solidjs/router";
import { createSignal, For, onMount, Show } from "solid-js";
import {
    CheckCircle2,
    ChevronDown,
    FileDiff,
    GitMerge,
    GitPullRequestDraft,
    MessageSquare,
    Plus,
    Search,
} from "lucide-solid";
import { useListNavigation, useSearchFocusTarget } from "../../lib/keyboard";
import { createHoverPrefetchHandlers } from "../../lib/prefetchCache";
import {
    landingDiffResource,
    landingDetailResource,
    landingsListResource,
    type LandingSummary,
} from "../../lib/navigationData";
import ShortcutBadge from "../keyboard/ShortcutBadge";
import "./LandingsList.css";

function formatRelativeTime(timestamp: string): string {
    const parsed = Date.parse(timestamp);
    if (Number.isNaN(parsed)) {
        return "recently";
    }
    const diffMinutes = Math.max(1, Math.floor((Date.now() - parsed) / 60000));
    if (diffMinutes < 60) {
        return `${diffMinutes}m ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
        return `${diffHours}h ago`;
    }
    return `${Math.floor(diffHours / 24)}d ago`;
}

export default function LandingsList() {
    const navigate = useNavigate();
    const params = useParams<{ owner: string; repo: string }>();
    const context = () => ({ owner: params.owner ?? "", repo: params.repo ?? "" });
    const initialLandings = landingsListResource.peek(context());
    const [filter, setFilter] = createSignal<"open" | "merged" | "closed" | "all">("open");
    const [searchQuery, setSearchQuery] = createSignal("");
    const [landings, setLandings] = createSignal<LandingSummary[]>(initialLandings ?? []);
    const [isLoading, setIsLoading] = createSignal(initialLandings === undefined);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    let searchInputRef: HTMLInputElement | undefined;

    const filteredLandings = () => {
        let rows = landings();
        if (filter() !== "all") {
            if (filter() === "open") {
                rows = rows.filter((landing) => landing.state === "open" || landing.state === "draft");
            } else {
                rows = rows.filter((landing) => landing.state === filter());
            }
        }
        if (searchQuery().trim()) {
            const q = searchQuery().toLowerCase();
            rows = rows.filter((landing) => {
                return (
                    landing.title.toLowerCase().includes(q) ||
                    landing.author.login.toLowerCase().includes(q) ||
                    landing.target_bookmark.toLowerCase().includes(q)
                );
            });
        }
        return rows;
    };

    const loadLandings = async () => {
        const cachedLandings = landingsListResource.peek(context());
        if (cachedLandings) {
            setLandings(cachedLandings);
        }

        setIsLoading(!cachedLandings);
        setErrorMessage(null);

        try {
            setLandings(await landingsListResource.load(context()));
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load landing requests";
            setErrorMessage(message);
            setLandings([]);
        } finally {
            setIsLoading(false);
        }
    };

    onMount(() => {
        void loadLandings();
    });

    const { selectedIndex, setSelectedIndex, setItemRef, selectedItemIds, isSelected } = useListNavigation({
        items: filteredLandings,
        onOpen: (landing) => navigate(`/${context().owner}/${context().repo}/landings/${landing.number}`),
        onFocusSearch: () => searchInputRef?.focus(),
        getItemId: (landing) => landing.number,
    });

    useSearchFocusTarget(() => searchInputRef?.focus());

    const getStatusIcon = (status: LandingSummary["state"]) => {
        switch (status) {
            case "open":
                return <GitMerge size={16} class="text-green" />;
            case "merged":
                return <GitMerge size={16} class="text-purple" />;
            case "draft":
                return <GitPullRequestDraft size={16} class="text-muted" />;
            case "closed":
                return <CheckCircle2 size={16} class="text-red" />;
            default:
                return <GitMerge size={16} class="text-muted" />;
        }
    };

    return (
        <div class="landings-view flex flex-col h-full w-full bg-app text-primary">
            <div class="view-header flex items-center justify-between p-6 border-b border-color flex-shrink-0 animate-in stagger-1">
                <div class="flex flex-col gap-1">
                    <h1 class="text-xl font-semibold flex items-center gap-2">
                        Landing Requests
                        <span class="badge-count subtle">{landings().length}</span>
                    </h1>
                </div>
                <div class="header-actions flex items-center gap-3">
                    <div class="search-box relative">
                        <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search landings..."
                            class="pl-9 pr-4 py-1.5 bg-panel border border-color rounded-md text-sm focus:border-blue transition-colors focus:outline-none w-64"
                            value={searchQuery()}
                            onInput={(event) => {
                                setSearchQuery(event.currentTarget.value);
                                setSelectedIndex(0);
                            }}
                        />
                    </div>
                    <button class="btn btn-primary flex items-center gap-2" type="button">
                        <Plus size={14} />
                        <span>New Landing</span>
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
                            <GitMerge size={16} class={filter() === "open" ? "text-green" : ""} />
                            <span>{landings().filter((landing) => landing.state === "open" || landing.state === "draft").length} Open</span>
                        </button>
                        <button
                            class={`flex items-center gap-2 transition-colors ${filter() === "merged" ? "text-primary" : "text-muted hover:text-secondary"}`}
                            onClick={() => {
                                setFilter("merged");
                                setSelectedIndex(0);
                            }}
                        >
                            <GitMerge size={16} class={filter() === "merged" ? "text-purple" : ""} />
                            <span>{landings().filter((landing) => landing.state === "merged").length} Merged</span>
                        </button>
                        <button
                            class={`flex items-center gap-2 transition-colors ${filter() === "closed" ? "text-primary" : "text-muted hover:text-secondary"}`}
                            onClick={() => {
                                setFilter("closed");
                                setSelectedIndex(0);
                            }}
                        >
                            <CheckCircle2 size={16} class={filter() === "closed" ? "text-red" : ""} />
                            <span>{landings().filter((landing) => landing.state === "closed").length} Closed</span>
                        </button>
                    </div>

                    <div class="flex items-center gap-4 text-sm text-secondary">
                        <button class="flex items-center gap-1 hover:text-primary transition-colors">
                            <span>Author</span>
                            <ChevronDown size={14} />
                        </button>
                        <button class="flex items-center gap-1 hover:text-primary transition-colors">
                            <span>Target</span>
                            <ChevronDown size={14} />
                        </button>
                        <button class="flex items-center gap-1 hover:text-primary transition-colors">
                            <span>Sort</span>
                            <ChevronDown size={14} />
                        </button>
                    </div>
                </div>

                <div
                    class="landings-list border border-t-0 border-color rounded-b-lg flex-1 overflow-y-auto bg-root animate-in stagger-3"
                    role="listbox"
                    tabindex={0}
                    aria-activedescendant={filteredLandings()[selectedIndex()] ? `landing-option-${filteredLandings()[selectedIndex()]!.number}` : undefined}
                >
                    <Show when={isLoading()}>
                        <div class="empty-state flex flex-col items-center justify-center h-48 text-muted">
                            <p>Loading landing requests...</p>
                        </div>
                    </Show>

                    <Show when={errorMessage() !== null}>
                        <div class="empty-state flex flex-col items-center justify-center h-48 text-red">
                            <p>{errorMessage()}</p>
                        </div>
                    </Show>

                    <Show when={!isLoading() && errorMessage() === null && filteredLandings().length === 0}>
                        <div class="empty-state flex flex-col items-center justify-center h-48 text-muted">
                            <GitMerge size={32} class="mb-4 opacity-50" />
                            <p>No landing requests match your current filters.</p>
                        </div>
                    </Show>

                    <For each={filteredLandings()}>
                        {(landing, index) => {
                            const prefetchHandlers = createHoverPrefetchHandlers(() => {
                                const detailHandle = landingDetailResource.prefetch(context(), String(landing.number));
                                const diffHandle = landingDiffResource.prefetch(context(), String(landing.number), "show");
                                return {
                                    cancel: () => {
                                        detailHandle.cancel();
                                        diffHandle.cancel();
                                    },
                                };
                            });

                            return (
                                <div
                                    id={`landing-option-${landing.number}`}
                                    class={`landing-row flex items-start gap-3 p-4 border-b border-light hover:bg-panel-hover transition-colors cursor-pointer group ${selectedIndex() === index() ? "selected-row bg-panel-hover" : ""} ${isSelected(landing, index()) ? "keyboard-multi-selected" : ""}`}
                                    role="option"
                                    aria-selected={selectedIndex() === index()}
                                    ref={(element) => setItemRef(index(), element)}
                                    onMouseEnter={() => {
                                        setSelectedIndex(index());
                                        prefetchHandlers.onMouseEnter();
                                    }}
                                    onMouseLeave={prefetchHandlers.onMouseLeave}
                                    onClick={() =>
                                        navigate(`/${context().owner}/${context().repo}/landings/${landing.number}`)
                                    }
                                >
                                    <div class="mt-1 flex-shrink-0">{getStatusIcon(landing.state)}</div>
                                    <div class="flex flex-col flex-1 min-w-0">
                                        <div class="flex items-center gap-2 mb-1 flex-wrap">
                                            <span class="font-medium text-base text-primary group-hover:text-blue transition-colors">
                                                {landing.title}
                                            </span>
                                            <Show when={landing.state === "draft"}>
                                                <span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-light bg-panel text-muted">
                                                    Draft
                                                </span>
                                            </Show>
                                            <span class="code-badge text-xs font-mono bg-panel border border-light px-1.5 py-0.5 rounded text-secondary flex items-center gap-1 ml-1">
                                                <FileDiff size={12} />
                                                {landing.target_bookmark}
                                            </span>
                                        </div>
                                        <div class="text-xs text-muted flex items-center gap-2">
                                            <span>
                                                LR-{landing.number} opened {formatRelativeTime(landing.created_at)} by{" "}
                                                <span class="text-secondary hover:text-primary transition-colors">{landing.author.login}</span>
                                            </span>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-1 text-muted text-xs flex-shrink-0 ml-4 border border-light bg-panel px-2 py-0.5 rounded shadow-sm">
                                        <MessageSquare size={12} />
                                        <span>{landing.stack_size}</span>
                                    </div>

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
                    <Show when={selectedItemIds().length > 0}>
                        <span>{selectedItemIds().length} selected</span>
                    </Show>
                </div>
            </div>
        </div>
    );
}
