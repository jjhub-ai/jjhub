import { useParams, useSearchParams } from "@solidjs/router";
import { createSignal, onMount, onCleanup } from 'solid-js';
import { TerminalSquare, SplitSquareHorizontal, Settings, RefreshCcw } from 'lucide-solid';
import { hasRepoContext, type RepoContext, repoApiFetch, repoApiPath } from '../../lib/repoContext';
import { createAuthenticatedEventSource, type SSEClient } from '../../lib/authenticatedEventSource';

export default function RepoTerminal() {
    let containerRef: HTMLDivElement | undefined;
    const [status, setStatus] = createSignal<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
    const params = useParams<{ owner: string; repo: string }>();
    const [searchParams] = useSearchParams<{ workspaceId: string }>();
    const ctx = () => ({ owner: params.owner ?? "", repo: params.repo ?? "" });
    const repoName = ctx().repo || 'repo';
    const activeWorkspaceId = searchParams.workspaceId;

    let sessionId: string | null = null;
    let sessionContext: RepoContext | null = null;
    let eventSource: SSEClient | null = null;
    let inputBatchTimer: ReturnType<typeof setTimeout> | null = null;
    let inputBuffer = '';

    const cleanup = () => {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        if (inputBatchTimer) {
            clearTimeout(inputBatchTimer);
            inputBatchTimer = null;
        }
        if (sessionId && sessionContext && hasRepoContext(sessionContext)) {
            // Best-effort destroy on cleanup
            const path = repoApiPath(`/workspace/sessions/${sessionId}/destroy`, sessionContext);
            navigator.sendBeacon?.(path);
            sessionId = null;
            sessionContext = null;
        }
    };

    onCleanup(cleanup);

    onMount(() => {
        import('xterm').then(({ Terminal }) => {
            import('xterm-addon-fit').then(({ FitAddon }) => {
                if (!containerRef) return;

                const term = new Terminal({
                    theme: {
                        background: '#07090D',
                        foreground: '#CDD7F4',
                        cursor: '#7B93D9',
                        selectionBackground: 'rgba(123, 147, 217, 0.3)',
                    },
                    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                    fontSize: 13,
                    cursorBlink: true,
                    convertEol: true
                });

                const fitAddon = new FitAddon();
                term.loadAddon(fitAddon);
                term.open(containerRef);
                fitAddon.fit();

                term.writeln('\x1b[1;36mJJHub Cloud Workspaces\x1b[0m');
                term.writeln(`Connecting to workspace${activeWorkspaceId ? ` ${activeWorkspaceId.split('-')[0]}` : ''} for ${repoName}...`);

                // Create session
                const cols = term.cols;
                const rows = term.rows;
                
                const body: Record<string, any> = { cols, rows };
                if (activeWorkspaceId) {
                    body.workspace_id = activeWorkspaceId;
                }

                const repoContext = ctx();
                if (!hasRepoContext(repoContext)) {
                    setStatus('error');
                    term.writeln('\x1b[1;31mOpen a repository route before starting a workspace session\x1b[0m');
                    return;
                }

                repoApiFetch('/workspace/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                }, repoContext).then(async (res) => {
                    if (!res.ok) {
                        setStatus('error');
                        term.writeln('\x1b[1;31mFailed to create workspace session\x1b[0m');
                        return;
                    }
                    const session = await res.json();
                    sessionId = session.id;
                    sessionContext = repoContext;

                    // Open SSE stream for output
                    const streamUrl = repoApiPath(`/workspace/sessions/${sessionId}/stream`, repoContext);
                    eventSource = createAuthenticatedEventSource(streamUrl);

                    eventSource.addEventListener('output', (e: MessageEvent) => {
                        try {
                            const parsed = JSON.parse(e.data);
                            if (parsed.data) {
                                // Decode base64 output
                                const decoded = atob(parsed.data);
                                term.write(decoded);
                            }
                        } catch {
                            // Raw data fallback
                            term.write(e.data);
                        }
                    });

                    eventSource.addEventListener('status', (e: MessageEvent) => {
                        try {
                            const parsed = JSON.parse(e.data);
                            if (parsed.status === 'running') {
                                setStatus('connected');
                            } else if (parsed.status === 'stopped' || parsed.status === 'failed') {
                                setStatus('disconnected');
                                term.writeln('\r\n\x1b[1;33m[Session ended]\x1b[0m');
                            }
                        } catch { /* ignore */ }
                    });

                    eventSource.onerror = () => {
                        setStatus('disconnected');
                    };

                    // Keystroke handler: batch keystrokes with 16ms debounce
                    term.onData((data: string) => {
                        inputBuffer += data;
                        if (!inputBatchTimer) {
                            inputBatchTimer = setTimeout(() => {
                                const batch = inputBuffer;
                                inputBuffer = '';
                                inputBatchTimer = null;
                                if (batch && sessionId && sessionContext) {
                                    const encoded = btoa(batch);
                                    repoApiFetch(`/workspace/sessions/${sessionId}/input`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ payload_type: 'data', data: encoded }),
                                    }, sessionContext).catch(() => { /* best-effort */ });
                                }
                            }, 16);
                        }
                    });

                    // Resize handler
                    const handleResize = () => {
                        fitAddon.fit();
                        if (sessionId && sessionContext) {
                            repoApiFetch(`/workspace/sessions/${sessionId}/input`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    payload_type: 'resize',
                                    cols: term.cols,
                                    rows: term.rows,
                                }),
                            }, sessionContext).catch(() => { /* best-effort */ });
                        }
                    };
                    window.addEventListener('resize', handleResize);
                    onCleanup(() => window.removeEventListener('resize', handleResize));

                }).catch(() => {
                    setStatus('error');
                    term.writeln('\x1b[1;31mFailed to connect to workspace\x1b[0m');
                });

                // Destroy on tab close
                const handleBeforeUnload = () => {
                    if (sessionId && sessionContext && hasRepoContext(sessionContext)) {
                        const path = repoApiPath(`/workspace/sessions/${sessionId}/destroy`, sessionContext);
                        navigator.sendBeacon?.(path);
                    }
                };
                window.addEventListener('beforeunload', handleBeforeUnload);
                onCleanup(() => window.removeEventListener('beforeunload', handleBeforeUnload));
            });
        });
    });

    const handleReconnect = () => {
        cleanup();
        setStatus('connecting');
        // Re-trigger by remounting - simplest approach
        window.location.reload();
    };

    return (
        <div class="flex flex-col h-full w-full bg-root text-primary">
            <div class="p-4 border-b border-color bg-panel flex justify-between items-center z-10 shrink-0">
                <div class="flex items-center gap-3">
                    <TerminalSquare size={18} class="text-blue" />
                    <div class="flex items-center gap-2">
                        <span class="font-medium text-sm">
                            {activeWorkspaceId ? activeWorkspaceId.split('-')[0] : "Workspace"}
                        </span>
                        <div class="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs border border-color bg-app">
                            <span class={`w-2 h-2 rounded-full ${status() === 'connected' ? 'bg-green shadow-[0_0_8px_rgba(40,190,136,0.5)]' :
                                    status() === 'error' ? 'bg-red' :
                                        status() === 'disconnected' ? 'bg-muted' :
                                            'bg-yellow animate-pulse'
                                }`}></span>
                            <span class="capitalize text-muted">{status()}</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button class="btn icon-btn border border-color hover:bg-panel tooltip opacity-80 hover:opacity-100 transition-opacity" title="Split pane"><SplitSquareHorizontal size={14} /></button>
                    <button class="btn icon-btn border border-color hover:bg-panel tooltip opacity-80 hover:opacity-100 transition-opacity" title="Reconnect" onClick={handleReconnect}><RefreshCcw size={14} /></button>
                    <button class="btn icon-btn border border-color hover:bg-panel tooltip opacity-80 hover:opacity-100 transition-opacity" title="Terminal Settings"><Settings size={14} /></button>
                </div>
            </div>

            <div class="flex-1 relative overflow-hidden bg-root p-4">
                <div ref={containerRef} class="absolute inset-4 overflow-hidden"></div>
            </div>
        </div>
    );
}
