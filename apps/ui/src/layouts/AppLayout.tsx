import { JSX, createSignal, onMount, createContext, useContext, Accessor, createEffect, onCleanup } from 'solid-js';
import { useLocation, useNavigate } from '@solidjs/router';
import { useStore } from '@nanostores/solid';
import Sidebar from '../components/Sidebar';
import AgentDock from '../components/shell/AgentDock';
import TerminalDock from '../components/shell/TerminalDock';
import GlobalStrip from '../components/shell/GlobalStrip';
import CommandPalette from '../components/shell/CommandPalette';
import KeyboardHelpModal from '../components/keyboard/KeyboardHelpModal';
import ChordIndicator from '../components/keyboard/ChordIndicator';
import { clearLocalAuth, getStoredToken, apiFetch, getCurrentRepoContext, logout as doLogout } from '../lib/repoContext';
import { syncSentryRouteContext, syncSentryUser } from '../lib/sentry';
import { hasRepoContext } from '../lib/repoContext';
import { isEditableTarget, requestSearchFocus, useChordShortcut } from '../lib/keyboard';
import {
    closeKeyboardHelp,
    isCommandPaletteOpen,
    isKeyboardHelpOpen,
    isKeyboardNavigationMode,
    openKeyboardHelp,
    toggleAgentDock,
    toggleCommandPalette,
    toggleSidebar,
    toggleTerminal,
} from '../stores/workbench';
import { setPinnedPagesScope } from '../stores/pinned-pages';
import '../styles/global.css';

export type AuthUser = {
    id: number;
    username: string;
    display_name?: string;
    email?: string;
};

type AuthContextValue = {
    user: Accessor<AuthUser | null>;
    isLoading: Accessor<boolean>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>();

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AppLayout");
    return ctx;
}

interface AppLayoutProps {
    children?: JSX.Element;
}

const PUBLIC_ROUTES = ['/login', '/waitlist', '/marketing', '/thank-you'];

export default function AppLayout(props: AppLayoutProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const $isKeyboardHelpOpen = useStore(isKeyboardHelpOpen);
    const $isKeyboardNavigationMode = useStore(isKeyboardNavigationMode);
    const [user, setUser] = createSignal<AuthUser | null>(null);
    const [isLoading, setIsLoading] = createSignal(true);

    const isPublicRoute = () => {
        const path = location.pathname.replace(/\/$/, '') || '/';
        return PUBLIC_ROUTES.some(r => path === r);
    };

    const handleLogout = async () => {
        syncSentryUser(null);
        await doLogout();
    };

    const repoContext = () => getCurrentRepoContext(location.pathname);

    const repoBase = () => hasRepoContext(repoContext()) ? `/${repoContext().owner}/${repoContext().repo}` : '';

    const { activeChord } = useChordShortcut({
        bindings: () => {
            const repoBindings = hasRepoContext(repoContext())
                ? [
                    { leader: 'g', key: 'l', description: 'Landings', action: () => navigate(`${repoBase()}/landings`) },
                    { leader: 'g', key: 'c', description: 'Changes', action: () => navigate(`${repoBase()}/changes`) },
                    { leader: 'g', key: 'b', description: 'Bookmarks', action: () => navigate(`${repoBase()}/bookmarks`) },
                    { leader: 'g', key: 'w', description: 'Workflows', action: () => navigate(`${repoBase()}/workflows`) },
                    { leader: 'g', key: 't', description: 'Terminal', action: () => navigate(`${repoBase()}/terminal`) },
                    { leader: 'g', key: 'g', description: 'Graph', action: () => navigate(`${repoBase()}/graph`) },
                ]
                : [];

            return [
                { leader: 'g', key: 'r', description: 'Repositories', action: () => navigate('/') },
                { leader: 'g', key: 'h', description: 'Repositories', action: () => navigate('/') },
                {
                    leader: 'g',
                    key: 'i',
                    description: 'Issues',
                    action: () => navigate(hasRepoContext(repoContext()) ? `${repoBase()}/issues` : '/search?type=issues'),
                },
                { leader: 'g', key: 'n', description: 'Inbox', action: () => navigate('/inbox') },
                { leader: 'g', key: 's', description: 'Settings', action: () => navigate('/settings') },
                ...repoBindings,
            ];
        },
        enabled: () => !isPublicRoute() && !isCommandPaletteOpen.get() && !$isKeyboardHelpOpen(),
    });

    createEffect(() => {
        syncSentryUser(user());
    });

    createEffect(() => {
        syncSentryRouteContext(location.pathname, isPublicRoute());
    });

    onMount(async () => {
        // Try to authenticate. The user may have:
        // 1. A token in localStorage (PAT or Key Auth flow)
        // 2. A session cookie (from GitHub OAuth redirect)
        // 3. Neither (not authenticated)
        // apiFetch sends credentials: "include" so cookies are always sent.
        // We try /api/user regardless of whether a token exists in localStorage,
        // because session cookies from OAuth are invisible to JS.
        try {
            const res = await apiFetch('/api/user');
            if (res.ok) {
                const data = await res.json();
                setUser(data);
                setPinnedPagesScope(String(data.id ?? data.username ?? ""));
                const path = location.pathname.replace(/\/$/, '') || '/';
                if (path === '/login') {
                    navigate('/', { replace: true });
                }
            } else {
                // Auth failed — clear any stale token
                const hadToken = getStoredToken() !== null;
                if (hadToken) {
                    clearLocalAuth();
                }
                setUser(null);
                setPinnedPagesScope(null);
                syncSentryUser(null);
                const path = location.pathname.replace(/\/$/, '') || '/';
                if (path === '/') {
                    navigate('/marketing', { replace: true });
                } else if (!PUBLIC_ROUTES.some(r => path === r)) {
                    navigate('/login', { replace: true });
                }
            }
        } catch {
            setPinnedPagesScope(null);
            syncSentryUser(null);
            const path = location.pathname.replace(/\/$/, '') || '/';
            if (path === '/') {
                navigate('/marketing', { replace: true });
            } else if (!PUBLIC_ROUTES.some(r => path === r)) {
                navigate('/login', { replace: true });
            }
        } finally {
            setIsLoading(false);
        }
    });

    onMount(() => {
        const updateKeyboardMode = (enabled: boolean) => {
            isKeyboardNavigationMode.set(enabled);
        };

        const handleGlobalShortcuts = (event: KeyboardEvent) => {
            if (isPublicRoute()) {
                return;
            }

            if (event.key === 'Escape' && $isKeyboardHelpOpen()) {
                event.preventDefault();
                closeKeyboardHelp();
                return;
            }

            if ($isKeyboardHelpOpen() || isCommandPaletteOpen.get()) {
                return;
            }

            if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
                if (isEditableTarget(event.target)) {
                    return;
                }
                event.preventDefault();
                if (!requestSearchFocus()) {
                    navigate('/search');
                }
                return;
            }

            if (isEditableTarget(event.target)) {
                return;
            }

            if (event.key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey) {
                event.preventDefault();
                if ($isKeyboardHelpOpen()) {
                    closeKeyboardHelp();
                } else {
                    openKeyboardHelp();
                }
                return;
            }

            if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                toggleCommandPalette();
                return;
            }

            if (event.key === 'b' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                toggleSidebar();
                return;
            }

            if (event.key === 'j' && (event.metaKey || event.ctrlKey) && hasRepoContext(repoContext())) {
                event.preventDefault();
                toggleAgentDock();
                return;
            }

            if (event.key === '`' && event.ctrlKey && !event.metaKey && !event.altKey && hasRepoContext(repoContext())) {
                event.preventDefault();
                toggleTerminal();
            }
        };

        const handleKeyboardActivity = (event: KeyboardEvent) => {
            if (event.key === 'Tab' || event.key.startsWith('Arrow') || event.key === 'Enter' || event.key === 'Escape' || event.key.length === 1) {
                updateKeyboardMode(true);
            }
        };

        const handlePointerActivity = () => updateKeyboardMode(false);

        window.addEventListener('keydown', handleGlobalShortcuts);
        window.addEventListener('keydown', handleKeyboardActivity, true);
        window.addEventListener('mousedown', handlePointerActivity, true);
        window.addEventListener('pointerdown', handlePointerActivity, true);

        onCleanup(() => {
            window.removeEventListener('keydown', handleGlobalShortcuts);
            window.removeEventListener('keydown', handleKeyboardActivity, true);
            window.removeEventListener('mousedown', handlePointerActivity, true);
            window.removeEventListener('pointerdown', handlePointerActivity, true);
        });
    });

    createEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        document.body.dataset.keyboardNav = $isKeyboardNavigationMode() ? 'true' : 'false';
    });

    return (
        <AuthContext.Provider value={{ user, isLoading, logout: handleLogout }}>
            <div
                id="app-window"
                class={`workbench-layout ${isPublicRoute() ? 'is-login' : ''}`}
            >
                {/* 1. Left Sidebar */}
                {!isPublicRoute() && (
                    <div>
                        <Sidebar activePath={`${location.pathname}${location.search ?? ''}`} />
                    </div>
                )}

                {/* 2. Center Content Area */}
                <div class="workbench-center">
                    {!isPublicRoute() && (
                        <div>
                            <GlobalStrip />
                        </div>
                    )}

                    <div class="workbench-main-stack">
                        <main class="main-content">
                            {props.children}
                        </main>

                        {!isPublicRoute() && (
                            <div>
                                <TerminalDock />
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Right Agent Dock */}
                {!isPublicRoute() && (
                    <div>
                        <AgentDock />
                    </div>
                )}

                {/* Overlays */}
                {!isPublicRoute() && (
                    <div>
                        <CommandPalette />
                    </div>
                )}

                {!isPublicRoute() && (
                    <>
                        <KeyboardHelpModal open={$isKeyboardHelpOpen()} onClose={closeKeyboardHelp} />
                        <ChordIndicator state={activeChord()} />
                    </>
                )}
            </div>
        </AuthContext.Provider>
    );
}
