import { useLocation } from "@solidjs/router";
import { createEffect, createSignal, For, onMount, Show } from 'solid-js';
import { useStore } from '@nanostores/solid';
import { isAgentDockOpen, toggleAgentDock } from '../../stores/workbench';
import { normalizePersistedAgentMessage } from '../../lib/agentMessages';
import {
    X, Bot, TerminalSquare, Send, Paperclip, Wrench, ChevronDown, List, Plus
} from 'lucide-solid';
import { getCurrentRepoContext, repoApiFetch } from '../../lib/repoContext';
import './AgentDock.css';

type Message = {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    type: 'text' | 'tool_call';
    tool?: string;
};

export default function AgentDock() {
    const $isOpen = useStore(isAgentDockOpen);
    const location = useLocation();
    const ctx = () => getCurrentRepoContext(location.pathname);
    const hasRepo = () => Boolean(ctx().repo && ctx().owner);
    const repoName = () => ctx().repo || '';

    const [messages, setMessages] = createSignal<Message[]>([]);
    const [inputVal, setInputVal] = createSignal('');
    const [sessionId, setSessionId] = createSignal<string | null>(null);
    const [isStreaming, setIsStreaming] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);
    const [recentSessions, setRecentSessions] = createSignal<{id: string, title?: string, status: string}[]>([]);
    const [showPicker, setShowPicker] = createSignal(false);

    const loadSession = async (sid: string) => {
        setSessionId(sid);
        setShowPicker(false);
        try {
            const res = await repoApiFetch(`/agent/sessions/${sid}/messages`, undefined, ctx());
            if (res.ok) {
                const msgs = await res.json();
                const formatted: Message[] = msgs.map((m: any) => {
                    const normalized = normalizePersistedAgentMessage(m);
                    return {
                        id: Number(m.id) || Date.now() + Math.random(),
                        role: m.role === 'user' ? 'user' : 'assistant',
                        content: normalized.text,
                        timestamp: new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        type: normalized.type === 'text' ? 'text' : 'tool_call',
                        tool: normalized.toolName
                    };
                });
                setMessages(formatted);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const loadRecentSessions = async () => {
        if (!hasRepo()) {
            setRecentSessions([]);
            return;
        }
        try {
            const res = await repoApiFetch(`/agent/sessions?per_page=10`, undefined, ctx());
            if (res.ok) {
                const data = await res.json();
                setRecentSessions(data);
                // Auto-load most recent running/active session if no session selected
                if (!sessionId() && data.length > 0) {
                    const active = data.find((s: any) => s.status === 'running' || s.status === 'started');
                    if (active) loadSession(active.id);
                }
            }
        } catch (e) {
            console.error("Failed to load sessions", e);
        }
    };

    onMount(() => {
        void loadRecentSessions();
    });

    createEffect(() => {
        if (hasRepo()) {
            void loadRecentSessions();
            return;
        }

        setRecentSessions([]);
        setSessionId(null);
        setMessages([]);
        setShowPicker(false);
    });

    const createNewSession = () => {
        setSessionId(null);
        setMessages([]);
        setShowPicker(false);
        setError(null);
    };

    const sendMessage = async () => {
        if (!inputVal().trim() || !hasRepo()) return;

        const userMsg: Message = {
            id: Date.now(),
            role: 'user',
            content: inputVal(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'text'
        };
        setMessages(prev => [...prev, userMsg]);
        const msgText = inputVal();
        setInputVal('');
        setError(null);

        try {
            let sid = sessionId();

            if (!sid) {
                const createRes = await repoApiFetch('/agent/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: msgText }),
                }, ctx());

                if (!createRes.ok) {
                    throw new Error(`Failed to create agent session (${createRes.status})`);
                }
                const session = await createRes.json();
                sid = session.id || session.session_id;
                setSessionId(sid);
            } else {
                const msgRes = await repoApiFetch(`/agent/sessions/${sid}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: msgText }),
                }, ctx());

                if (!msgRes.ok) {
                    throw new Error(`Failed to send message (${msgRes.status})`);
                }
            }

            setIsStreaming(true);
            const streamRes = await repoApiFetch(`/agent/sessions/${sid}/stream`, {}, ctx());
            if (!streamRes.ok) {
                throw new Error(`Failed to stream response (${streamRes.status})`);
            }

            const reader = streamRes.body?.getReader();
            if (!reader) {
                throw new Error('No response stream available');
            }

            const decoder = new TextDecoder();
            let assistantContent = '';
            const assistantMsg: Message = {
                id: Date.now() + 1,
                role: 'assistant',
                content: '',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: 'text',
            };
            setMessages(prev => [...prev, assistantMsg]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                assistantContent += parsed.content;
                                setMessages(prev => prev.map(m =>
                                    m.id === assistantMsg.id ? { ...m, content: assistantContent } : m
                                ));
                            }
                        } catch {
                            assistantContent += data;
                            setMessages(prev => prev.map(m =>
                                m.id === assistantMsg.id ? { ...m, content: assistantContent } : m
                            ));
                        }
                    }
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to communicate with agent';
            setError(message);
        } finally {
            setIsStreaming(false);
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div class={`agent-dock ${$isOpen() ? 'open' : ''}`}>
            <div class="dock-header">
                <div class="dock-title relative">
                    <Bot size={16} class="text-purple" />
                    <span>JJHub Agent</span>
                    <Show when={hasRepo()}>
                        <div class="relative inline-block ml-2">
                            <button class="agent-context-badge flex items-center gap-1 hover:bg-panel cursor-pointer" onClick={() => setShowPicker(!showPicker())}>
                                {sessionId() ? (recentSessions().find(s => s.id === sessionId())?.title || sessionId()!.slice(0, 8)) : 'New Session'}
                                <ChevronDown size={12} />
                            </button>
                            <Show when={showPicker()}>
                                <div class="absolute top-full left-0 mt-1 w-48 bg-panel border border-color rounded shadow-lg z-50 flex flex-col py-1">
                                    <button class="text-left px-3 py-1.5 text-sm hover:bg-divider flex items-center gap-2 text-blue" onClick={createNewSession}>
                                        <Plus size={14} /> New Session
                                    </button>
                                    <div class="h-px bg-color my-1"></div>
                                    <div class="max-h-48 overflow-y-auto">
                                        <For each={recentSessions()}>
                                            {(s) => (
                                                <button class="text-left px-3 py-1.5 text-sm hover:bg-divider block w-full truncate text-muted hover:text-primary" onClick={() => loadSession(s.id)}>
                                                    {s.title || s.id.slice(0, 8)} {s.status === 'running' && '🟢'}
                                                </button>
                                            )}
                                        </For>
                                    </div>
                                    <div class="h-px bg-color my-1"></div>
                                    <a href={`/${ctx().owner}/${ctx().repo}/sessions`} class="text-left px-3 py-1.5 text-sm font-medium hover:bg-divider flex items-center gap-2">
                                        <List size={14} /> View All
                                    </a>
                                </div>
                            </Show>
                        </div>
                    </Show>
                </div>
                <div class="dock-header-actions">
                    <button class="icon-btn" onClick={toggleAgentDock} title="Close (⌘J)">
                        <X size={16} />
                    </button>
                </div>
            </div>

            <div class="dock-content messages-area">
                <Show when={!hasRepo()}>
                    <div class="message assistant-message">
                        <div class="message-avatar">
                            <Bot size={16} class="text-purple" />
                        </div>
                        <div class="message-body">
                            <div class="message-content text-muted">
                                Select a repository to start an agent session.
                            </div>
                        </div>
                    </div>
                </Show>

                <Show when={hasRepo() && messages().length === 0 && !error()}>
                    <div class="message assistant-message">
                        <div class="message-avatar">
                            <Bot size={16} class="text-purple" />
                        </div>
                        <div class="message-body">
                            <div class="message-content text-muted">
                                Send a message to start a new agent session in <strong>{repoName()}</strong>.
                            </div>
                        </div>
                    </div>
                </Show>

                <Show when={error()}>
                    <div class="message" style={{ padding: "0.5rem 1rem" }}>
                        <div class="text-red text-sm">{error()}</div>
                    </div>
                </Show>

                <For each={messages()}>
                    {(msg) => {
                        if (msg.type === 'tool_call') {
                            return (
                                <div class="message tool-message">
                                    <div class="tool-icon-wrapper">
                                        <Wrench size={12} class="text-muted" />
                                    </div>
                                    <div class="tool-content">
                                        <span class="tool-name">{msg.tool}</span>
                                        <span class="tool-args">{msg.content}</span>
                                    </div>
                                </div>
                            )
                        }

                        return (
                            <div class={`message ${msg.role}-message`}>
                                <div class="message-avatar">
                                    {msg.role === 'assistant' ? <Bot size={16} class="text-purple" /> : 'You'}
                                </div>
                                <div class="message-body">
                                    <div class="message-meta">
                                        <span class="message-author">{msg.role === 'assistant' ? 'JJHub Agent' : 'You'}</span>
                                        <span class="message-time">{msg.timestamp}</span>
                                    </div>
                                    <div class="message-content">
                                        {msg.content}
                                        <Show when={msg.role === 'assistant' && !msg.content && isStreaming()}>
                                            <span class="text-muted">Thinking...</span>
                                        </Show>
                                    </div>
                                </div>
                            </div>
                        )
                    }}
                </For>
            </div>

            <div class="dock-footer composer-area">
                <div class="composer-suggestions">
                    <button class="suggestion-btn" onClick={() => setInputVal('/review')} disabled={!hasRepo()}>/review</button>
                    <button class="suggestion-btn" onClick={() => setInputVal('/explain')} disabled={!hasRepo()}>/explain</button>
                    <button class="suggestion-btn" onClick={() => setInputVal('/fix')} disabled={!hasRepo()}>/fix</button>
                </div>
                <div class="composer-box">
                    <div class="composer-toolbar">
                        <button class="toolbar-btn tooltip-trigger" title="Attach Context">
                            <Paperclip size={14} />
                        </button>
                        <button class="toolbar-btn tooltip-trigger" title="Run Terminal Command">
                            <TerminalSquare size={14} />
                        </button>
                    </div>
                    <textarea
                        class="composer-input"
                        placeholder={hasRepo() ? "Ask the agent..." : "Select a repository first"}
                        value={inputVal()}
                        onInput={(e) => {
                            setInputVal(e.currentTarget.value);
                            e.currentTarget.style.height = 'auto';
                            e.currentTarget.style.height = (e.currentTarget.scrollHeight) + 'px';
                        }}
                        onKeyDown={handleKeyDown}
                        rows="1"
                        disabled={!hasRepo() || isStreaming()}
                    ></textarea>
                    <button class="send-btn" classList={{ active: inputVal().trim().length > 0 }} onClick={sendMessage} disabled={!hasRepo() || isStreaming()}>
                        <Send size={14} fill="currentColor" />
                    </button>
                </div>
            </div>
        </div>
    );
}
