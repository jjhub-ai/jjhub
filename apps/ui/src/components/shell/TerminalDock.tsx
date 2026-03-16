import { useLocation } from "@solidjs/router";
import { createSignal, createEffect, onMount, onCleanup, For, Show } from 'solid-js';
import { useStore } from '@nanostores/solid';
import { isTerminalOpen, toggleTerminal } from '../../stores/workbench';
import { X, TerminalSquare, Plus, Trash2 } from 'lucide-solid';
import { getCurrentRepoContext, hasRepoContext, type RepoContext, repoApiFetch, repoApiPath } from '../../lib/repoContext';
import { createAuthenticatedEventSource, type SSEClient } from '../../lib/authenticatedEventSource';
import { connectWebRTCTerminal, type WebRTCTerminalSession } from '../../lib/webrtcTerminal';
import type { Terminal } from 'xterm';
import type { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import './TerminalDock.css';

interface TermTab {
    id: string;
    title: string;
    term?: Terminal;
    fitAddon?: FitAddon;
    sessionId?: string;
    eventSource?: SSEClient;
    webrtcSession?: WebRTCTerminalSession;
    repoContext?: RepoContext;
}

export default function TerminalDock() {
    const $isOpen = useStore(isTerminalOpen);
    const location = useLocation();
    const currentRepoContext = () => getCurrentRepoContext(location.pathname);

    const [tabs, setTabs] = createSignal<TermTab[]>([{ id: 't1', title: 'bash' }]);
    const [activeTabId, setActiveTabId] = createSignal<string>('t1');

    const containerRefs: Record<string, HTMLDivElement> = {};

    const destroyTabSession = (tab: TermTab) => {
        if (tab.webrtcSession) {
            tab.webrtcSession.close();
        }
        if (tab.eventSource) {
            tab.eventSource.close();
        }
        if (tab.sessionId && tab.repoContext && hasRepoContext(tab.repoContext)) {
            repoApiFetch(`/workspace/sessions/${tab.sessionId}/destroy`, {
                method: 'POST',
            }, tab.repoContext).catch(() => { /* best-effort */ });
        }
    };

    const connectTerminal = async (tab: TermTab, term: Terminal) => {
        const cols = term.cols;
        const rows = term.rows;
        const repoContext = currentRepoContext();
        const repoName = repoContext.repo || 'repo';

        term.writeln(`\x1b[1;36mConnecting to workspace for ${repoName}...\x1b[0m`);

        if (!hasRepoContext(repoContext)) {
            term.writeln('\x1b[1;33mOpen a repository route before starting a terminal session.\x1b[0m');
            return;
        }

        try {
            const res = await repoApiFetch('/workspace/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cols, rows }),
            }, repoContext);

            if (!res.ok) {
                term.writeln('\x1b[1;31mFailed to create workspace session\x1b[0m');
                return;
            }

            const session = await res.json();
            const sessionId = session.id as string;

            // Update tab state with session ID
            setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, sessionId, repoContext } : t));

            // Open SSE stream
            const streamUrl = repoApiPath(`/workspace/sessions/${sessionId}/stream`, repoContext);
            const eventSource = createAuthenticatedEventSource(streamUrl);

            setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, eventSource } : t));

            connectWebRTCTerminal({
                sessionId,
                term,
                eventSource,
                repoContext,
                onDisconnected: () => {
                    term.writeln('\r\n\x1b[1;33m[Session ended]\x1b[0m');
                },
                onError: () => {
                    term.writeln('\x1b[1;31mConnection error\x1b[0m');
                }
            }).then((sess) => {
                setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, webrtcSession: sess } : t));
            });

        } catch {
            term.writeln('\x1b[1;31mFailed to connect to workspace\x1b[0m');
        }
    };

    const createTermInstance = async (id: string, container: HTMLDivElement) => {
        const { Terminal } = await import('xterm');
        const { FitAddon } = await import('xterm-addon-fit');

        const term = new Terminal({
            theme: {
                background: '#07090D',
                foreground: '#F0F2F5',
                cursor: '#9BA1AD',
                selectionBackground: 'rgba(123, 147, 217, 0.3)',
                black: '#11151C',
                red: '#F05252',
                green: '#59C173',
                yellow: '#E3B341',
                blue: '#7B93D9',
                magenta: '#9061F9',
                cyan: '#3BC9DB',
                white: '#F0F2F5'
            },
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace",
            fontSize: 13,
            cursorBlink: true
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(container);

        setTabs(prev => prev.map(t => t.id === id ? { ...t, term, fitAddon } : t));

        if (isTerminalOpen.get() && activeTabId() === id) {
            setTimeout(() => fitAddon.fit(), 50);
        }

        // Connect to real backend
        const tab = tabs().find(t => t.id === id);
        if (tab) {
            await connectTerminal({ ...tab, term, fitAddon }, term);
        }
    };

    const addTab = () => {
        const newId = 't' + Date.now();
        setTabs([...tabs(), { id: newId, title: 'bash' }]);
        setActiveTabId(newId);
    };

    const removeTab = (id: string, e?: Event) => {
        if (e) e.stopPropagation();

        const currentTabs = tabs();
        const tabToRemove = currentTabs.find(t => t.id === id);

        if (tabToRemove) {
            destroyTabSession(tabToRemove);
            if (tabToRemove.term) {
                tabToRemove.term.dispose();
            }
        }

        const newTabs = currentTabs.filter(t => t.id !== id);
        setTabs(newTabs);

        if (newTabs.length === 0) {
            toggleTerminal();
        } else if (activeTabId() === id) {
            setActiveTabId(newTabs[newTabs.length - 1].id);
        }
    };

    onMount(() => {
        const handleResize = () => {
            if (!isTerminalOpen.get()) return;
            const activeTab = tabs().find(t => t.id === activeTabId());
            if (activeTab?.fitAddon) {
                activeTab.fitAddon.fit();
                if (activeTab.webrtcSession && activeTab.term) {
                    activeTab.webrtcSession.resize(activeTab.term.cols, activeTab.term.rows);
                }
            }
        };

        window.addEventListener('resize', handleResize);

        const handleBeforeUnload = () => {
            tabs().forEach(tab => {
                if (tab.sessionId && tab.repoContext && hasRepoContext(tab.repoContext)) {
                    const path = repoApiPath(`/workspace/sessions/${tab.sessionId}/destroy`, tab.repoContext);
                    navigator.sendBeacon?.(path);
                }
            });
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        onCleanup(() => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            tabs().forEach(tab => {
                destroyTabSession(tab);
                tab.term?.dispose();
            });
        });
    });

    createEffect(() => {
        if ($isOpen()) {
            const activeTab = tabs().find(t => t.id === activeTabId());
            setTimeout(() => activeTab?.fitAddon?.fit(), 300);
        }
    });

    return (
        <div class={`terminal-dock ${$isOpen() ? 'open' : ''}`}>
            <div class="dock-header terminal-header">
                <div class="dock-tabs">
                    <For each={tabs()}>
                        {(tab) => (
                            <div
                                class="terminal-tab"
                                classList={{ active: activeTabId() === tab.id }}
                                onClick={() => setActiveTabId(tab.id)}
                            >
                                <TerminalSquare size={14} />
                                <span>{tab.title}</span>
                                <Show when={tabs().length > 1}>
                                    <X
                                        size={12}
                                        class="tab-close ml-2 text-muted hover:text-primary transition-colors"
                                        onClick={(e) => removeTab(tab.id, e)}
                                    />
                                </Show>
                            </div>
                        )}
                    </For>
                    <button class="icon-btn tab-add" onClick={addTab} title="New Terminal">
                        <Plus size={14} />
                    </button>
                </div>
                <div class="dock-actions">
                    <button class="icon-btn" onClick={() => removeTab(activeTabId())} title="Kill Terminal">
                        <Trash2 size={14} />
                    </button>
                    <button class="icon-btn" onClick={toggleTerminal}>
                        <X size={16} />
                    </button>
                </div>
            </div>

            <div class="dock-content terminal-content">
                <For each={tabs()}>
                    {(tab) => (
                        <div
                            ref={(el) => {
                                if (el && !containerRefs[tab.id]) {
                                    containerRefs[tab.id] = el;
                                    createTermInstance(tab.id, el);
                                }
                            }}
                            class="xterm-wrapper h-full w-full"
                            style={{ display: activeTabId() === tab.id ? 'block' : 'none' }}
                        />
                    )}
                </For>
            </div>
        </div>
    );
}
