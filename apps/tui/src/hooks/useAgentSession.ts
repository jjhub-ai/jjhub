import { useState, useEffect, useCallback, useRef } from "react";
import { repoApiFetch } from "@jjhub/ui-core";
import type { RepoContext, PersistedAgentMessage } from "@jjhub/ui-core";
import { normalizePersistedAgentMessage } from "@jjhub/ui-core";

export type ChatMessage = {
    id: number | string;
    role: "user" | "assistant" | "system";
    content: string;
    type: "text" | "tool_call" | "tool_result";
    toolName?: string;
    timestamp: string;
};

export type UseAgentSessionResult = {
    messages: ChatMessage[];
    loading: boolean;
    error: Error | undefined;
    streaming: boolean;
    sessionId: string | null;
    createSession: (initialMessage: string) => Promise<void>;
    sendMessage: (content: string) => Promise<void>;
    loadSession: (sessionId: string) => Promise<void>;
};

function formatTimestamp(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function normalizeToChat(msg: PersistedAgentMessage): ChatMessage {
    const normalized = normalizePersistedAgentMessage(msg);
    return {
        id: msg.id,
        role: msg.role === "user" ? "user" : msg.role === "system" ? "system" : "assistant",
        content: normalized.text,
        type: normalized.type,
        toolName: normalized.toolName || undefined,
        timestamp: formatTimestamp(msg.created_at || new Date().toISOString()),
    };
}

export function useAgentSession(context: RepoContext): UseAgentSessionResult {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | undefined>(undefined);
    const [streaming, setStreaming] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Cleanup SSE on unmount
    useEffect(() => {
        return () => {
            abortRef.current?.abort();
        };
    }, []);

    const loadSession = useCallback(
        async (sid: string) => {
            setLoading(true);
            setError(undefined);
            setSessionId(sid);

            try {
                const res = await repoApiFetch(`/agent/sessions/${sid}/messages`, {}, context);
                if (!res.ok) {
                    throw new Error(`Failed to load messages (${res.status})`);
                }
                const body = await res.json();
                const msgs: ChatMessage[] = Array.isArray(body)
                    ? body.map((m: PersistedAgentMessage) => normalizeToChat(m))
                    : [];
                setMessages(msgs);
            } catch (err) {
                setError(err instanceof Error ? err : new Error(String(err)));
            } finally {
                setLoading(false);
            }
        },
        [context.owner, context.repo],
    );

    const streamResponse = useCallback(
        async (sid: string) => {
            setStreaming(true);
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            try {
                const streamRes = await repoApiFetch(
                    `/agent/sessions/${sid}/stream`,
                    { signal: controller.signal },
                    context,
                );
                if (!streamRes.ok) {
                    throw new Error(`Failed to stream response (${streamRes.status})`);
                }

                const reader = streamRes.body?.getReader();
                if (!reader) {
                    throw new Error("No response stream available");
                }

                const decoder = new TextDecoder();
                let assistantContent = "";
                const assistantId = `stream-${Date.now()}`;

                setMessages((prev) => [
                    ...prev,
                    {
                        id: assistantId,
                        role: "assistant",
                        content: "",
                        type: "text",
                        timestamp: formatTimestamp(new Date().toISOString()),
                    },
                ]);

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split("\n");
                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const data = line.slice(6);
                            if (data === "[DONE]") continue;
                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.content) {
                                    assistantContent += parsed.content;
                                    setMessages((prev) =>
                                        prev.map((m) =>
                                            m.id === assistantId
                                                ? { ...m, content: assistantContent }
                                                : m,
                                        ),
                                    );
                                }
                            } catch {
                                assistantContent += data;
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === assistantId
                                            ? { ...m, content: assistantContent }
                                            : m,
                                    ),
                                );
                            }
                        }
                    }
                }
            } catch (err) {
                if (controller.signal.aborted) return;
                setError(err instanceof Error ? err : new Error(String(err)));
            } finally {
                setStreaming(false);
                abortRef.current = null;
            }
        },
        [context.owner, context.repo],
    );

    const createSession = useCallback(
        async (initialMessage: string) => {
            setError(undefined);

            // Add optimistic user message
            const userMsg: ChatMessage = {
                id: `user-${Date.now()}`,
                role: "user",
                content: initialMessage,
                type: "text",
                timestamp: formatTimestamp(new Date().toISOString()),
            };
            setMessages([userMsg]);

            try {
                const createRes = await repoApiFetch("/agent/sessions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: initialMessage.slice(0, 100) }),
                }, context);

                if (!createRes.ok) {
                    throw new Error(`Failed to create session (${createRes.status})`);
                }

                const session = await createRes.json();
                const sid = session.id || session.session_id;
                setSessionId(sid);

                // Send the initial message
                const msgRes = await repoApiFetch(`/agent/sessions/${sid}/messages`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        role: "user",
                        parts: [{ type: "text", content: initialMessage }],
                    }),
                }, context);

                if (!msgRes.ok) {
                    throw new Error(`Failed to send message (${msgRes.status})`);
                }

                await streamResponse(sid);
            } catch (err) {
                setError(err instanceof Error ? err : new Error(String(err)));
            }
        },
        [context.owner, context.repo, streamResponse],
    );

    const sendMessage = useCallback(
        async (content: string) => {
            if (!sessionId) return;
            setError(undefined);

            const userMsg: ChatMessage = {
                id: `user-${Date.now()}`,
                role: "user",
                content,
                type: "text",
                timestamp: formatTimestamp(new Date().toISOString()),
            };
            setMessages((prev) => [...prev, userMsg]);

            try {
                const msgRes = await repoApiFetch(`/agent/sessions/${sessionId}/messages`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        role: "user",
                        parts: [{ type: "text", content }],
                    }),
                }, context);

                if (!msgRes.ok) {
                    throw new Error(`Failed to send message (${msgRes.status})`);
                }

                await streamResponse(sessionId);
            } catch (err) {
                setError(err instanceof Error ? err : new Error(String(err)));
            }
        },
        [context.owner, context.repo, sessionId, streamResponse],
    );

    return {
        messages,
        loading,
        error,
        streaming,
        sessionId,
        createSession,
        sendMessage,
        loadSession,
    };
}
