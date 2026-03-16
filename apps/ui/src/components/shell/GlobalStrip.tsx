import { useLocation } from "@solidjs/router";
import { useStore } from "@nanostores/solid";
import { createMemo, createSignal, onMount, onCleanup } from 'solid-js';
import { toggleSidebar, toggleAgentDock, toggleTerminal, toggleCommandPalette } from '../../stores/workbench';
import { Menu, Search, Bot, TerminalSquare, Activity, AlertCircle, Pin, PinOff } from 'lucide-solid';
import { getCurrentRepoContext, hasRepoContext } from '../../lib/repoContext';
import { getShortcutText } from "../../lib/keyboard";
import { isMacPlatform } from "../../lib/keyboard/utils";
import { describePinnedPage } from "../../lib/pinnedPages";
import { $pinnedPages, $pinnedPagesReady, PINNED_PAGES_LIMIT, togglePinnedPage } from "../../stores/pinned-pages";
import ShortcutBadge from '../keyboard/ShortcutBadge';
import './GlobalStrip.css';

function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export default function GlobalStrip() {
    const location = useLocation();
    const $pinned = useStore($pinnedPages);
    const $pinnedReady = useStore($pinnedPagesReady);
    const ctx = () => getCurrentRepoContext(location.pathname);
    const hasRepo = () => hasRepoContext(ctx());
    const repoName = () => ctx().repo || 'jjhub';
    const [connected, setConnected] = createSignal(false);
    const currentPage = createMemo(() => describePinnedPage(`${location.pathname}${location.search ?? ""}`));
    const shortcutPlatform = () => (isMacPlatform() ? "mac" : "default");
    const pinShortcut = () => getShortcutText("page.pin", shortcutPlatform());
    const isCurrentPagePinned = () => $pinned().some((page) => page.url === currentPage().url);
    const pinLimitReached = () => $pinned().length >= PINNED_PAGES_LIMIT && !isCurrentPagePinned();
    const pinningDisabled = () => !$pinnedReady() || pinLimitReached();
    const pinButtonLabel = () => {
        if (!$pinnedReady()) {
            return "Pinned pages are loading";
        }

        if (pinLimitReached()) {
            return `Pinned pages limit reached (${PINNED_PAGES_LIMIT})`;
        }

        const action = isCurrentPagePinned() ? "Unpin this page" : "Pin this page";
        return pinShortcut() ? `${action} (${pinShortcut()})` : action;
    };
    const handleTogglePin = () => {
        if (pinningDisabled()) {
            return;
        }

        togglePinnedPage(currentPage());
    };

    onMount(() => {
        let timer: ReturnType<typeof setInterval>;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (
                event.code !== "KeyP"
                || !event.altKey
                || event.metaKey
                || event.ctrlKey
                || event.shiftKey
                || isEditableTarget(event.target)
                || !$pinnedPagesReady.get()
            ) {
                return;
            }

            event.preventDefault();
            handleTogglePin();
        };

        const checkHealth = async () => {
            try {
                const res = await fetch('/api/health', { method: 'GET' });
                setConnected(res.ok);
            } catch {
                setConnected(false);
            }
        };

        checkHealth();
        timer = setInterval(checkHealth, 30000);
        window.addEventListener("keydown", handleKeyDown);
        onCleanup(() => {
            clearInterval(timer);
            window.removeEventListener("keydown", handleKeyDown);
        });
    });

    return (
        <div class="global-strip">
            <div class="strip-left">
                <button class="strip-btn" onClick={toggleSidebar}>
                    <Menu size={16} />
                </button>
                <div class="strip-context">
                    <span class="context-label">{repoName()}</span>
                </div>
            </div>

            <div class="strip-center">
                <button class="search-bar" onClick={toggleCommandPalette}>
                    <Search size={14} class="search-icon" />
                    <span>Search or jump to...</span>
                    <ShortcutBadge shortcutId="palette.open" />
                </button>
            </div>

            <div class="strip-right">
                <div class="status-indicator">
                    {connected() ? (
                        <>
                            <Activity size={14} class="text-green" />
                            <span>Connected</span>
                        </>
                    ) : (
                        <>
                            <AlertCircle size={14} class="text-yellow-500" />
                            <span>Disconnected</span>
                        </>
                    )}
                </div>
                <button
                    class={`strip-btn ${isCurrentPagePinned() ? "is-active" : ""}`}
                    aria-label={pinButtonLabel()}
                    aria-pressed={isCurrentPagePinned()}
                    disabled={pinningDisabled()}
                    onClick={handleTogglePin}
                    title={pinButtonLabel()}
                >
                    {isCurrentPagePinned() ? <PinOff size={16} /> : <Pin size={16} />}
                </button>
                <button
                    class="strip-btn"
                    onClick={() => hasRepo() && toggleTerminal()}
                    title={hasRepo() ? "Toggle Terminal (Ctrl+`)" : "Open a repository to use the terminal"}
                    disabled={!hasRepo()}
                >
                    <TerminalSquare size={16} />
                </button>
                <button
                    class="strip-btn"
                    onClick={() => hasRepo() && toggleAgentDock()}
                    title={hasRepo() ? "Toggle Agent Dock (⌘J)" : "Open a repository to use the agent"}
                    disabled={!hasRepo()}
                >
                    <Bot size={16} />
                </button>
            </div>
        </div>
    );
}
