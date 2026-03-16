import { useState, useEffect, useCallback } from "react";
import { repoApiFetch } from "@jjhub/ui-core";
import type { RepoContext } from "@jjhub/ui-core";

export type AgentSession = {
    id: string;
    title?: string;
    status: "started" | "running" | "completed" | "failed" | "cancelled";
    created_at: string;
    updated_at?: string;
};

export type UseAgentSessionsResult = {
    sessions: AgentSession[] | undefined;
    loading: boolean;
    error: Error | undefined;
    refetch: () => void;
    deleteSession: (sessionId: string) => Promise<void>;
};

export function useAgentSessions(context: RepoContext): UseAgentSessionsResult {
    const [sessions, setSessions] = useState<AgentSession[] | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | undefined>(undefined);
    const [fetchKey, setFetchKey] = useState(0);

    const refetch = useCallback(() => {
        setFetchKey((k) => k + 1);
    }, []);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(undefined);

        repoApiFetch("/agent/sessions?per_page=50", {}, context)
            .then(async (response) => {
                if (cancelled) return;
                if (!response.ok) {
                    throw new Error(`Failed to load agent sessions (${response.status})`);
                }
                const body = await response.json();
                setSessions(Array.isArray(body) ? (body as AgentSession[]) : []);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err instanceof Error ? err : new Error(String(err)));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [context.owner, context.repo, fetchKey]);

    const deleteSession = useCallback(
        async (sessionId: string) => {
            try {
                const response = await repoApiFetch(`/agent/sessions/${sessionId}`, {
                    method: "DELETE",
                }, context);
                if (!response.ok) {
                    throw new Error(`Failed to delete session (${response.status})`);
                }
                // Remove from local state immediately
                setSessions((prev) =>
                    prev ? prev.filter((s) => s.id !== sessionId) : prev,
                );
            } catch (err) {
                setError(err instanceof Error ? err : new Error(String(err)));
            }
        },
        [context.owner, context.repo],
    );

    return { sessions, loading, error, refetch, deleteSession };
}
