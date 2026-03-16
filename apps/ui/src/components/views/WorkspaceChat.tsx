import { useParams } from "@solidjs/router";
import { createSignal, For, Show } from 'solid-js';
import {
    TerminalSquare, Send, Paperclip, Wrench,
    GitCommit, ChevronRight, Bot, Command
} from 'lucide-solid';
import { getCurrentRepoContext, repoApiFetch } from '../../lib/repoContext';
import './WorkspaceChat.css';

type Message = {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    type: 'text' | 'tool_call';
    tool?: string;
};

export default function WorkspaceChat() {
    const params = useParams<{ owner: string; repo: string }>();
    const ctx = () => ({ owner: params.owner ?? "", repo: params.repo ?? "" });
    const hasRepo = Boolean(ctx().repo);
    const repoName = ctx().repo || 'repo';

    const [messages, setMessages] = createSignal<Message[]>([]);
    const [inputVal, setInputVal] = createSignal('');
    const [sessionId, setSessionId] = createSignal<string | null>(null);
    const [isStreaming, setIsStreaming] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);

    const sendMessage = async () => {
        if (!inputVal().trim() || !hasRepo) return;

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
                    body: JSON.stringify({ title: msgText.slice(0, 100) }),
                }, ctx());

                if (!createRes.ok) {
                    throw new Error(`Failed to create agent session (${createRes.status})`);
                }
                const session = await createRes.json();
                sid = session.id;
                setSessionId(sid);
            }

            // Send the user message (both for new and existing sessions)
            const msgRes = await repoApiFetch(`/agent/sessions/${sid}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: 'user',
                    parts: [{ type: 'text', content: msgText }],
                }),
            }, ctx());

            if (!msgRes.ok) {
                throw new Error(`Failed to send message (${msgRes.status})`);
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
        <div class="workspace-chat-container">
            <header class="chat-header">
                <div class="repo-context">
                    <span class="repo-name">{repoName}</span>
                    <span class="slash">/</span>
                    <Bot size={16} class="text-blue" />
                    <span class="agent-name">Agent Session</span>
                </div>
            </header>

            <div class="messages-area">
                <Show when={!hasRepo}>
                    <div class="message assistant-message">
                        <div class="message-avatar">
                            <Bot size={18} class="text-blue" />
                        </div>
                        <div class="message-body">
                            <div class="message-content text-muted">
                                Select a repository to start an agent session.
                            </div>
                        </div>
                    </div>
                </Show>

                <Show when={hasRepo && messages().length === 0 && !error()}>
                    <div class="message assistant-message">
                        <div class="message-avatar">
                            <Bot size={18} class="text-blue" />
                        </div>
                        <div class="message-body">
                            <div class="message-content text-muted">
                                Send a message to start a new agent session in <strong>{repoName}</strong>.
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
                                        <Wrench size={14} class="text-muted" />
                                    </div>
                                    <div class="tool-content">
                                        <span class="tool-name">{msg.tool}</span>
                                        <span class="tool-args">{msg.content}</span>
                                        <ChevronRight size={14} class="text-muted" />
                                    </div>
                                </div>
                            )
                        }

                        return (
                            <div class={`message ${msg.role}-message`}>
                                <div class="message-avatar">
                                    {msg.role === 'assistant' ? <Bot size={18} class="text-blue" /> : 'You'}
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
                <div class="spacer"></div>
            </div>

            <div class="composer-area">
                <div class="composer-suggestions">
                    <button class="suggestion-btn" onClick={() => setInputVal('/@agent fix tests')} disabled={!hasRepo}>/@agent fix tests</button>
                    <button class="suggestion-btn" onClick={() => setInputVal('/jj diff')} disabled={!hasRepo}>/jj diff</button>
                    <button class="suggestion-btn" onClick={() => setInputVal('/landing create')} disabled={!hasRepo}>/landing create</button>
                </div>
                <div class="composer-box">
                    <div class="composer-toolbar">
                        <button class="toolbar-btn tooltip-trigger" title="Attach Context">
                            <Paperclip size={18} />
                        </button>
                        <button class="toolbar-btn tooltip-trigger" title="Run Terminal Command">
                            <TerminalSquare size={18} />
                        </button>
                    </div>
                    <textarea
                        class="composer-input"
                        placeholder={hasRepo ? "Tell the agent what to do, or type '/' for commands..." : "Select a repository first"}
                        value={inputVal()}
                        onInput={(e) => {
                            setInputVal(e.currentTarget.value);
                            e.currentTarget.style.height = 'auto';
                            e.currentTarget.style.height = (e.currentTarget.scrollHeight) + 'px';
                        }}
                        onKeyDown={handleKeyDown}
                        rows="1"
                        disabled={!hasRepo || isStreaming()}
                    ></textarea>
                    <button class="send-btn" classList={{ active: inputVal().trim().length > 0 }} onClick={sendMessage} disabled={!hasRepo || isStreaming()}>
                        <Send size={16} fill="currentColor" />
                    </button>
                </div>
                <div class="composer-footer">
                    <span><Command size={12} class="inline-icon" /> J to jump</span>
                    <span><kbd>Enter</kbd> to send</span>
                </div>
            </div>
        </div>
    );
}
