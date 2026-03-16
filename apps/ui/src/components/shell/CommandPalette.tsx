import { useLocation, useNavigate } from "@solidjs/router";
import { createSignal, createEffect, onMount, onCleanup, For, Show } from 'solid-js';
import { useStore } from '@nanostores/solid';
import { isCommandPaletteOpen, openKeyboardHelp, toggleAgentDock, toggleCommandPalette, toggleSidebar, toggleTerminal } from '../../stores/workbench';
import { Search, FileCode, MessageSquare, Briefcase, TerminalSquare, Settings, CheckCircle2, User, FileText, Loader2, Bot, Cloud, GitMerge, BookMarked, Activity, Zap, GitCommit, BookOpen, Tag, Milestone, Bell, Heart } from 'lucide-solid';
import { getCurrentRepoContext, apiFetch } from '../../lib/repoContext';
import { requestKeyboardAction, requestSearchFocus } from '../../lib/keyboard';
import ShortcutBadge from '../keyboard/ShortcutBadge';
import { filterPaletteItems } from './commandPaletteSearch';
import {
    COMMANDS as SHARED_COMMANDS,
    CATEGORY_COLORS,
    CATEGORY_LABELS,
    getAvailableCommands,
    fuzzyMatch,
    type CommandDefinition,
    type CommandCategory,
} from '@jjhub/ui-core';
import './CommandPalette.css';

interface PaletteItem {
    id: string;
    type: 'command' | 'file' | 'issue' | 'user' | 'repo';
    label: string;
    sublabel?: string;
    icon: any;
    status?: string;
    shortcutId?: string;
    category?: CommandCategory;
    action?: () => void;
}

// API response types matching the Go service layer
interface RepositorySearchResult {
    id: number;
    owner: string;
    name: string;
    full_name: string;
    description: string;
    is_public: boolean;
    topics: string[];
}

interface IssueSearchResult {
    id: number;
    repository_id: number;
    repository_owner: string;
    repository_name: string;
    number: number;
    title: string;
    state: string;
}

interface UserSearchResult {
    id: number;
    username: string;
    display_name: string;
    avatar_url: string;
}

interface CodeSearchResult {
    repository_id: number;
    repository_owner: string;
    repository_name: string;
    path: string;
    snippet: string;
}

interface SearchResultPage<T> {
    items: T[];
    total_count: number;
    page: number;
    per_page: number;
}

/** Map shared command IDs to lucide icons */
const COMMAND_ICONS: Record<string, any> = {
    repos: Briefcase,
    repo: Briefcase,
    search: Search,
    notifications: Bell,
    settings: Settings,
    issues: CheckCircle2,
    issue: CheckCircle2,
    landings: GitMerge,
    changes: GitCommit,
    diff: FileCode,
    bookmarks: BookMarked,
    wiki: BookOpen,
    labels: Tag,
    milestones: Milestone,
    'issue-new': FileText,
    'lr-new': GitMerge,
    'workspace-create': Cloud,
    'workspace-ssh': TerminalSquare,
    'sync-now': Zap,
    'agent-new': Bot,
    sync: Activity,
    conflicts: FileCode,
    health: Heart,
    workspace: Cloud,
    agent: Bot,
};

/** Map shared command IDs to keyboard shortcut IDs in the web UI */
const COMMAND_SHORTCUT_IDS: Record<string, string> = {
    repos: 'nav.home',
    settings: 'nav.settings',
    issues: 'nav.issues',
    landings: 'nav.landings',
    changes: 'nav.changes',
    bookmarks: 'nav.bookmarks',
    notifications: 'nav.inbox',
};

export default function CommandPalette() {
    const $isOpen = useStore(isCommandPaletteOpen);
    const [query, setQuery] = createSignal('');
    const [activeIndex, setActiveIndex] = createSignal(0);
    const [loading, setLoading] = createSignal(false);
    const [apiResults, setApiResults] = createSignal<PaletteItem[]>([]);
    const [recentCommandIds, setRecentCommandIds] = createSignal<string[]>(loadRecentCommands());

    const location = useLocation();
    const navigate = useNavigate();
    const ctx = () => getCurrentRepoContext(location.pathname);
    const repoBase = () => (ctx().owner && ctx().repo) ? `/${ctx().owner}/${ctx().repo}` : '';
    const hasRepo = () => Boolean(repoBase());
    const isIssueDetailRoute = () => /\/issues\/[^/]+$/.test(location.pathname);
    const isLandingDetailRoute = () => /\/landings\/[^/]+$/.test(location.pathname);

    let inputRef: HTMLInputElement | undefined;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let abortController: AbortController | undefined;

    const runAfterPaletteClose = (action: () => void) => {
        window.setTimeout(action, 0);
    };

    const focusSearch = () => {
        runAfterPaletteClose(() => {
            if (!requestSearchFocus()) {
                navigate('/search');
            }
        });
    };

    const triggerKeyboardAction = (action: 'comment' | 'assign' | 'label') => {
        runAfterPaletteClose(() => {
            requestKeyboardAction(action);
        });
    };

    /** Record a command execution for the "recent" section */
    function recordRecent(id: string) {
        const recent = recentCommandIds().filter((r) => r !== id);
        recent.unshift(id);
        const trimmed = recent.slice(0, 5);
        setRecentCommandIds(trimmed);
        saveRecentCommands(trimmed);
    }

    /** Build the route-navigation action for a shared command */
    function resolveCommandAction(cmd: CommandDefinition): (() => void) | undefined {
        const base = repoBase();
        switch (cmd.id) {
            case 'repos': return () => navigate('/');
            case 'repo': return () => navigate('/');
            case 'search': return focusSearch;
            case 'notifications': return () => navigate('/inbox');
            case 'settings': return () => navigate('/settings');
            case 'issues': return () => navigate(`${base}/issues`);
            case 'issue': return () => navigate(`${base}/issues`);
            case 'landings': return () => navigate(`${base}/landings`);
            case 'changes': return () => navigate(`${base}/changes`);
            case 'diff': return () => navigate(`${base}/changes`);
            case 'bookmarks': return () => navigate(`${base}/bookmarks`);
            case 'wiki': return () => navigate(`${base}/wiki`);
            case 'labels': return () => navigate(`${base}/issues`);
            case 'milestones': return () => navigate(`${base}/issues`);
            case 'issue-new': return () => navigate(`${base}/issues/new`);
            case 'lr-new': return () => navigate(`${base}/landings`);
            case 'workspace-create': return () => navigate('/workspaces');
            case 'workspace-ssh': return () => navigate(`${base}/terminal`);
            case 'sync-now': return () => navigate('/');
            case 'agent-new': return () => { toggleAgentDock(); };
            case 'sync': return () => navigate('/');
            case 'conflicts': return () => navigate(`${base}/conflicts`);
            case 'health': return () => navigate('/admin/health');
            case 'workspace': return () => navigate('/workspaces');
            case 'agent': return () => navigate(`${base}/sessions`);
            default: return undefined;
        }
    }

    /** Convert shared CommandDefinitions into PaletteItems */
    function sharedCommandsToPaletteItems(cmds: CommandDefinition[]): PaletteItem[] {
        return cmds.map((cmd) => ({
            id: `shared-${cmd.id}`,
            type: 'command' as const,
            label: cmd.label,
            icon: COMMAND_ICONS[cmd.id] ?? Search,
            shortcutId: COMMAND_SHORTCUT_IDS[cmd.id],
            category: cmd.category,
            action: resolveCommandAction(cmd),
        }));
    }

    /** Get shared commands filtered by current repo context */
    const sharedCommands = (): PaletteItem[] => {
        const available = getAvailableCommands(hasRepo());
        return sharedCommandsToPaletteItems(available);
    };

    /** Get fuzzy-matched shared commands */
    const fuzzySharedCommands = (q: string): PaletteItem[] => {
        const available = getAvailableCommands(hasRepo());
        const matched = fuzzyMatch(q, available);
        return sharedCommandsToPaletteItems(matched);
    };

    /** Web-only UI commands (panel toggles, etc.) that don't exist in the shared set */
    const webOnlyCommands = (): PaletteItem[] => {
        const items: PaletteItem[] = [
            { id: 'web-toggle-sidebar', type: 'command', label: 'Toggle Sidebar', icon: Briefcase, shortcutId: 'panel.sidebar', category: 'action', action: toggleSidebar },
            { id: 'web-toggle-agent', type: 'command', label: 'Toggle Agent Dock', icon: MessageSquare, shortcutId: 'panel.agentDock', category: 'action', action: toggleAgentDock },
            { id: 'web-toggle-terminal', type: 'command', label: 'Toggle Terminal Dock', icon: TerminalSquare, shortcutId: 'panel.terminal', category: 'action', action: toggleTerminal },
            { id: 'web-keyboard-shortcuts', type: 'command', label: 'Open Keyboard Shortcuts', icon: Search, shortcutId: 'help.open', category: 'action', action: openKeyboardHelp },
            { id: 'web-create-repo', type: 'command', label: 'Create Repository', icon: Briefcase, category: 'action', action: () => navigate('/repo/new') },
        ];

        if (!hasRepo()) {
            items.push({
                id: 'web-search-issues',
                type: 'command',
                label: 'Search Issues',
                icon: CheckCircle2,
                category: 'action',
                action: () => navigate('/search?type=issues'),
            });
        }

        if (hasRepo()) {
            items.push({
                id: 'web-go-graph',
                type: 'command',
                label: 'Go to Graph',
                icon: FileCode,
                category: 'repo',
                action: () => navigate(`${repoBase()}/graph`),
            });
        }

        if (isIssueDetailRoute()) {
            items.push(
                {
                    id: 'issue-comment',
                    type: 'command',
                    label: 'Comment on Issue',
                    icon: MessageSquare,
                    shortcutId: 'issue.comment',
                    category: 'action',
                    action: () => triggerKeyboardAction('comment'),
                },
                {
                    id: 'issue-assign',
                    type: 'command',
                    label: 'Edit Issue Assignees',
                    icon: User,
                    shortcutId: 'issue.assign',
                    category: 'action',
                    action: () => triggerKeyboardAction('assign'),
                },
                {
                    id: 'issue-labels',
                    type: 'command',
                    label: 'Edit Issue Labels',
                    icon: CheckCircle2,
                    shortcutId: 'issue.labels',
                    category: 'action',
                    action: () => triggerKeyboardAction('label'),
                },
            );
        }

        if (isLandingDetailRoute()) {
            items.push({
                id: 'landing-comment',
                type: 'command',
                label: 'Comment on Landing Request',
                icon: MessageSquare,
                shortcutId: 'landing.comment',
                category: 'action',
                action: () => triggerKeyboardAction('comment'),
            });
        }

        return items;
    };

    /** Unified command list: shared commands + web-only commands */
    const allCommands = (): PaletteItem[] => {
        return [...sharedCommands(), ...webOnlyCommands()];
    };

    const prefixHelpItems = (): PaletteItem[] => [
        { id: 'prefix-command', type: 'command', label: 'Use > for commands', sublabel: 'Run local JJHub actions', icon: Search, action: () => setQuery('>') },
        { id: 'prefix-issue', type: 'command', label: 'Use # for issues', sublabel: 'Search issues across repositories', icon: CheckCircle2, action: () => setQuery('#') },
        { id: 'prefix-user', type: 'command', label: 'Use @ for users', sublabel: 'Search people and profiles', icon: User, action: () => setQuery('@') },
        { id: 'prefix-default', type: 'command', label: 'No prefix searches repos and code', sublabel: 'Open repositories and files', icon: FileCode, action: () => setQuery('') },
    ];

    /** Build items with recent commands first when query is empty */
    const recentItems = (): PaletteItem[] => {
        const recent = recentCommandIds();
        const all = allCommands();
        if (recent.length === 0) return all.slice(0, 10);

        const recentItems: PaletteItem[] = [];
        const seen = new Set<string>();

        for (const id of recent) {
            const item = all.find((c) => c.id === id);
            if (item) {
                recentItems.push(item);
                seen.add(id);
            }
        }

        // Fill remaining with non-recent commands
        for (const item of all) {
            if (recentItems.length >= 10) break;
            if (!seen.has(item.id)) {
                recentItems.push(item);
            }
        }

        return recentItems;
    };

    onCleanup(() => {
        if (debounceTimer) clearTimeout(debounceTimer);
        if (abortController) abortController.abort();
    });

    async function searchIssues(term: string, signal: AbortSignal): Promise<PaletteItem[]> {
        const resp = await apiFetch(`/api/search/issues?q=${encodeURIComponent(term)}&per_page=5`, { signal });
        if (!resp.ok) return [];
        const data: SearchResultPage<IssueSearchResult> = await resp.json();
        return (data.items ?? []).map((issue) => ({
            id: `issue-${issue.id}`,
            type: 'issue' as const,
            label: issue.title,
            sublabel: `${issue.repository_owner}/${issue.repository_name}`,
            icon: CheckCircle2,
            status: issue.state,
            action: () => {
                navigate(`/${issue.repository_owner}/${issue.repository_name}/issues/${issue.number}`);
            },
        }));
    }

    async function searchUsers(term: string, signal: AbortSignal): Promise<PaletteItem[]> {
        const resp = await apiFetch(`/api/search/users?q=${encodeURIComponent(term)}&per_page=5`, { signal });
        if (!resp.ok) return [];
        const data: SearchResultPage<UserSearchResult> = await resp.json();
        return (data.items ?? []).map((user) => ({
            id: `user-${user.id}`,
            type: 'user' as const,
            label: user.username,
            sublabel: user.display_name || undefined,
            icon: User,
            action: () => {
                navigate(`/users/${user.username}`);
            },
        }));
    }

    async function searchRepositories(term: string, signal: AbortSignal): Promise<PaletteItem[]> {
        const resp = await apiFetch(`/api/search/repositories?q=${encodeURIComponent(term)}&per_page=5`, { signal });
        if (!resp.ok) return [];
        const data: SearchResultPage<RepositorySearchResult> = await resp.json();
        return (data.items ?? []).map((repo) => ({
            id: `repo-${repo.id}`,
            type: 'repo' as const,
            label: repo.full_name,
            sublabel: repo.description || undefined,
            icon: Briefcase,
            action: () => {
                navigate(`/${repo.owner}/${repo.name}/code`);
            },
        }));
    }

    async function searchCode(term: string, signal: AbortSignal): Promise<PaletteItem[]> {
        const resp = await apiFetch(`/api/search/code?q=${encodeURIComponent(term)}&per_page=5`, { signal });
        if (!resp.ok) return [];
        const data: SearchResultPage<CodeSearchResult> = await resp.json();
        return (data.items ?? []).map((result, idx) => ({
            id: `code-${result.repository_id}-${idx}`,
            type: 'file' as const,
            label: result.path,
            sublabel: `${result.repository_owner}/${result.repository_name}`,
            icon: FileCode,
            action: () => {
                navigate(`/${result.repository_owner}/${result.repository_name}/code?path=${encodeURIComponent(result.path)}`);
            },
        }));
    }

    function debouncedSearch(q: string) {
        if (debounceTimer) clearTimeout(debounceTimer);
        if (abortController) abortController.abort();

        // Commands are local-only, no API call needed
        if (!q || q.startsWith('>') || q.startsWith('?')) {
            setApiResults([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        debounceTimer = setTimeout(async () => {
            const controller = new AbortController();
            abortController = controller;

            try {
                let results: PaletteItem[] = [];

                if (q.startsWith('#')) {
                    const term = q.slice(1).trim();
                    if (term) {
                        results = await searchIssues(term, controller.signal);
                    }
                } else if (q.startsWith('@')) {
                    const term = q.slice(1).trim();
                    if (term) {
                        results = await searchUsers(term, controller.signal);
                    }
                } else {
                    // Default: search repos + code in parallel
                    const [repos, code] = await Promise.all([
                        searchRepositories(q, controller.signal),
                        searchCode(q, controller.signal),
                    ]);
                    results = [...repos, ...code];
                }

                if (!controller.signal.aborted) {
                    setApiResults(results);
                    setLoading(false);
                }
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                if (!controller.signal.aborted) {
                    setApiResults([]);
                    setLoading(false);
                }
            }
        }, 200);
    }

    // Watch query changes and trigger search
    createEffect(() => {
        const q = query();
        setActiveIndex(0);
        debouncedSearch(q);
    });

    // Compute displayed results: combine local commands with API results
    const displayedResults = () => {
        const q = query().toLowerCase();

        if (!q) {
            return recentItems();
        }

        if (q.startsWith('?')) {
            const term = q.slice(1).trim();
            return filterPaletteItems(prefixHelpItems(), term);
        }

        if (q.startsWith('>')) {
            const term = q.slice(1).trim();
            if (!term) return allCommands();
            // Use shared fuzzy matcher for commands, plus web-only via existing filter
            const sharedMatched = fuzzySharedCommands(term);
            const webMatched = filterPaletteItems(webOnlyCommands(), term);
            return [...sharedMatched, ...webMatched];
        }

        if (q.startsWith('#') || q.startsWith('@')) {
            return apiResults();
        }

        // Default: fuzzy-matched shared commands + web commands + API results
        const sharedMatched = fuzzySharedCommands(q);
        const webMatched = filterPaletteItems(webOnlyCommands(), q);
        return [...sharedMatched, ...webMatched, ...apiResults()].slice(0, 12);
    };

    createEffect(() => {
        if (!$isOpen()) {
            return;
        }

        setQuery('');
        setActiveIndex(0);
        setApiResults([]);
        setLoading(false);
        setTimeout(() => inputRef?.focus(), 50);
    });

    // Palette-local navigation while the overlay is open.
    onMount(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isCommandPaletteOpen.get()) return;

            if (e.key === 'Escape') {
                e.preventDefault();
                toggleCommandPalette();
                return;
            }

            const resultsLength = displayedResults().length;
            if (resultsLength === 0) return;

            if (e.key === 'ArrowDown' || (e.key === 'j' && e.ctrlKey)) {
                e.preventDefault();
                setActiveIndex((prev) => (prev + 1) % resultsLength);
            } else if (e.key === 'ArrowUp' || (e.key === 'k' && e.ctrlKey)) {
                e.preventDefault();
                setActiveIndex((prev) => (prev - 1 + resultsLength) % resultsLength);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const selected = displayedResults()[activeIndex()];
                if (selected && selected.action) {
                    recordRecent(selected.id);
                    selected.action();
                    toggleCommandPalette();
                } else if (selected) {
                    toggleCommandPalette();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
    });

    return (
        <div class={`palette-overlay ${$isOpen() ? 'open' : ''}`} onClick={toggleCommandPalette}>
            <div class="palette-modal" onClick={(e) => e.stopPropagation()}>
                <div class="palette-input-wrapper">
                    <Show when={loading()} fallback={<Search size={18} class="palette-icon" />}>
                        <Loader2 size={18} class="palette-icon palette-spinner" />
                    </Show>
                    <input
                        ref={inputRef}
                        type="text"
                        class="palette-input"
                        placeholder="Search cmds (>), issues (#), users (@)..."
                        aria-label="Command palette"
                        value={query()}
                        onInput={(e) => setQuery(e.currentTarget.value)}
                        autofocus
                    />
                </div>

                <div class="palette-results">
                    <Show when={loading() && displayedResults().length === 0}>
                        <div class="palette-loading text-muted">Searching...</div>
                    </Show>

                    <Show when={!loading() && displayedResults().length === 0 && query().length > 0}>
                        <div class="palette-empty text-muted">No results found for "{query()}"</div>
                    </Show>

                    <For each={displayedResults()}>
                        {(item, i) => (
                            <div
                                class="palette-item"
                                classList={{ active: activeIndex() === i() }}
                                onMouseEnter={() => setActiveIndex(i())}
                                onClick={() => {
                                    if (item.action) {
                                        recordRecent(item.id);
                                        item.action();
                                    }
                                    toggleCommandPalette();
                                }}
                            >
                                <item.icon size={14} class={`item-icon ${iconColorClass(item)}`} />
                                <span class="item-label">
                                    {item.label}
                                    <Show when={item.sublabel}>
                                        <span class="item-sublabel text-muted"> {item.sublabel}</span>
                                    </Show>
                                </span>
                                <div class="palette-item-meta">
                                    <Show when={item.category}>
                                        <span class={`palette-category-badge palette-category-${item.category}`}>
                                            {CATEGORY_LABELS[item.category!]}
                                        </span>
                                    </Show>
                                    <Show when={item.type === 'issue' && item.status}>
                                        <span class={`item-meta ${item.status === 'open' ? 'text-green' : 'text-muted'}`}>{item.status}</span>
                                    </Show>
                                    <ShortcutBadge shortcutId={item.shortcutId} class="item-shortcut" />
                                </div>
                            </div>
                        )}
                    </For>
                </div>

                <div class="palette-footer">
                    <span><ShortcutBadge keys={[['ArrowUp'], ['ArrowDown']]} /> navigate</span>
                    <span><ShortcutBadge shortcutId="list.open" /> select</span>
                    <span><kbd>Esc</kbd> dismiss</span>
                </div>
            </div>
        </div>
    );
}

/** Determine icon color class based on item type and category */
function iconColorClass(item: PaletteItem): string {
    if (item.type === 'issue') {
        return item.status === 'closed' ? 'text-red' : 'text-green';
    }
    if (item.type === 'repo') return 'text-blue';
    if (item.type === 'file') return 'text-secondary';
    if (item.type === 'user') return 'text-cyan';

    // Command type: use category color
    if (item.category) {
        const color = CATEGORY_COLORS[item.category];
        switch (color) {
            case 'blue': return 'text-blue';
            case 'purple': return 'text-purple';
            case 'green': return 'text-green';
            case 'yellow': return 'text-yellow';
            case 'cyan': return 'text-cyan';
            case 'orange': return 'text-orange';
            default: return 'text-purple';
        }
    }

    return 'text-purple';
}

const RECENT_STORAGE_KEY = 'jjhub.palette.recent';

function loadRecentCommands(): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as string[];
    } catch {
        return [];
    }
}

function saveRecentCommands(ids: string[]) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(ids));
    } catch {
        // Ignore storage failures
    }
}
