import { useLocation, useNavigate } from "@solidjs/router";
import { createSignal, createEffect, onMount, onCleanup, For, Show } from 'solid-js';
import { useStore } from '@nanostores/solid';
import { isCommandPaletteOpen, openKeyboardHelp, toggleAgentDock, toggleCommandPalette, toggleSidebar, toggleTerminal } from '../../stores/workbench';
import { Search, FileCode, MessageSquare, Briefcase, TerminalSquare, Settings, CheckCircle2, User, FileText, Loader2 } from 'lucide-solid';
import { getCurrentRepoContext, apiFetch } from '../../lib/repoContext';
import { requestKeyboardAction, requestSearchFocus } from '../../lib/keyboard';
import ShortcutBadge from '../keyboard/ShortcutBadge';
import { filterPaletteItems } from './commandPaletteSearch';
import './CommandPalette.css';

interface PaletteItem {
    id: string;
    type: 'command' | 'file' | 'issue' | 'user' | 'repo';
    label: string;
    sublabel?: string;
    icon: any;
    status?: string;
    shortcutId?: string;
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

export default function CommandPalette() {
    const $isOpen = useStore(isCommandPaletteOpen);
    const [query, setQuery] = createSignal('');
    const [activeIndex, setActiveIndex] = createSignal(0);
    const [loading, setLoading] = createSignal(false);
    const [apiResults, setApiResults] = createSignal<PaletteItem[]>([]);

    const location = useLocation();
    const navigate = useNavigate();
    const ctx = () => getCurrentRepoContext(location.pathname);
    const repoBase = () => (ctx().owner && ctx().repo) ? `/${ctx().owner}/${ctx().repo}` : '';
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

    const allCommands = (): PaletteItem[] => {
        const items: PaletteItem[] = [
            { id: 'c0', type: 'command', label: 'Toggle Sidebar', icon: Briefcase, shortcutId: 'panel.sidebar', action: toggleSidebar },
            { id: 'c1', type: 'command', label: 'Toggle Agent Dock', icon: MessageSquare, shortcutId: 'panel.agentDock', action: toggleAgentDock },
            { id: 'c2', type: 'command', label: 'Toggle Terminal Dock', icon: TerminalSquare, shortcutId: 'panel.terminal', action: toggleTerminal },
            { id: 'c3', type: 'command', label: 'Open Settings', icon: Settings, shortcutId: 'nav.settings', action: () => navigate('/settings') },
            { id: 'c4', type: 'command', label: 'Open Keyboard Shortcuts', icon: Search, shortcutId: 'help.open', action: openKeyboardHelp },
            { id: 'c5', type: 'command', label: 'Open Search', icon: Search, shortcutId: 'search.focus', action: focusSearch },
            { id: 'c6', type: 'command', label: 'Create Repository', icon: Briefcase, action: () => navigate('/repo/new') },
            { id: 'c7', type: 'command', label: 'Go to Repositories', icon: Briefcase, shortcutId: 'nav.home', action: () => navigate('/') },
            { id: 'c8', type: 'command', label: 'Go to Inbox', icon: MessageSquare, shortcutId: 'nav.inbox', action: () => navigate('/inbox') },
        ];

        if (!repoBase()) {
            items.push({
                id: 'c9',
                type: 'command',
                label: 'Search Issues',
                icon: CheckCircle2,
                action: () => navigate('/search?type=issues'),
            });
        }

        if (repoBase()) {
            items.push(
                {
                    id: 'c10',
                    type: 'command',
                    label: 'Create Issue',
                    icon: FileText,
                    action: () => navigate(`${repoBase()}/issues/new`),
                },
                {
                    id: 'c11',
                    type: 'command',
                    label: 'Go to Issues',
                    icon: CheckCircle2,
                    shortcutId: 'nav.issues',
                    action: () => navigate(`${repoBase()}/issues`),
                },
                {
                    id: 'c12',
                    type: 'command',
                    label: 'Go to Landing Requests',
                    icon: FileText,
                    shortcutId: 'nav.landings',
                    action: () => navigate(`${repoBase()}/landings`),
                },
                {
                    id: 'c13',
                    type: 'command',
                    label: 'Go to Changes',
                    icon: FileCode,
                    shortcutId: 'nav.changes',
                    action: () => navigate(`${repoBase()}/changes`),
                },
                {
                    id: 'c14',
                    type: 'command',
                    label: 'Go to Bookmarks',
                    icon: Briefcase,
                    shortcutId: 'nav.bookmarks',
                    action: () => navigate(`${repoBase()}/bookmarks`),
                },
                {
                    id: 'c15',
                    type: 'command',
                    label: 'Go to Graph',
                    icon: FileCode,
                    action: () => navigate(`${repoBase()}/graph`),
                },
            );
        }

        if (isIssueDetailRoute()) {
            items.push(
                {
                    id: 'issue-comment',
                    type: 'command',
                    label: 'Comment on Issue',
                    icon: MessageSquare,
                    shortcutId: 'issue.comment',
                    action: () => triggerKeyboardAction('comment'),
                },
                {
                    id: 'issue-assign',
                    type: 'command',
                    label: 'Edit Issue Assignees',
                    icon: User,
                    shortcutId: 'issue.assign',
                    action: () => triggerKeyboardAction('assign'),
                },
                {
                    id: 'issue-labels',
                    type: 'command',
                    label: 'Edit Issue Labels',
                    icon: CheckCircle2,
                    shortcutId: 'issue.labels',
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
                action: () => triggerKeyboardAction('comment'),
            });
        }

        return items;
    };

    const prefixHelpItems = (): PaletteItem[] => [
        { id: 'prefix-command', type: 'command', label: 'Use > for commands', sublabel: 'Run local JJHub actions', icon: Search, action: () => setQuery('>') },
        { id: 'prefix-issue', type: 'command', label: 'Use # for issues', sublabel: 'Search issues across repositories', icon: CheckCircle2, action: () => setQuery('#') },
        { id: 'prefix-user', type: 'command', label: 'Use @ for users', sublabel: 'Search people and profiles', icon: User, action: () => setQuery('@') },
        { id: 'prefix-default', type: 'command', label: 'No prefix searches repos and code', sublabel: 'Open repositories and files', icon: FileCode, action: () => setQuery('') },
    ];

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
            return allCommands().slice(0, 7);
        }

        if (q.startsWith('?')) {
            const term = q.slice(1).trim();
            return filterPaletteItems(prefixHelpItems(), term);
        }

        if (q.startsWith('>')) {
            const term = q.slice(1).trim();
            return filterPaletteItems(allCommands(), term);
        }

        if (q.startsWith('#') || q.startsWith('@')) {
            return apiResults();
        }

        // Default: local command matches + API results (repos, code)
        const commandMatches = filterPaletteItems(allCommands(), q);
        return [...commandMatches, ...apiResults()].slice(0, 10);
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

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((prev) => (prev + 1) % resultsLength);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((prev) => (prev - 1 + resultsLength) % resultsLength);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const selected = displayedResults()[activeIndex()];
                if (selected && selected.action) {
                    selected.action();
                    toggleCommandPalette();
                } else if (selected) {
                    console.log('Selected:', selected);
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
                                    if (item.action) item.action();
                                    toggleCommandPalette();
                                }}
                            >
                                <item.icon size={14} class={`item-icon ${item.type === 'issue' ? (item.status === 'closed' ? 'text-red' : 'text-green') : item.type === 'command' ? 'text-purple' : item.type === 'repo' ? 'text-blue' : 'text-secondary'}`} />
                                <span class="item-label">
                                    {item.label}
                                    <Show when={item.sublabel}>
                                        <span class="item-sublabel text-muted"> {item.sublabel}</span>
                                    </Show>
                                </span>
                                <div class="palette-item-meta">
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
