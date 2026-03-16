import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@jjhub/ui-core";

export type SyncConflict = {
    id: string;
    method: string;
    path: string;
    error: string;
    created_at: string;
    local_value?: string;
    server_value?: string;
};

export type UseConflictsResult = {
    conflicts: SyncConflict[];
    loading: boolean;
    error: Error | undefined;
    refetch: () => void;
    resolveConflict: (id: string) => Promise<void>;
    retryConflict: (id: string) => Promise<void>;
};

export function useConflicts(): UseConflictsResult {
    const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
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

        apiFetch("/api/daemon/conflicts")
            .then(async (response) => {
                if (cancelled) return;
                if (!response.ok) {
                    throw new Error(`Failed to load conflicts (${response.status})`);
                }
                const body = await response.json();
                setConflicts(Array.isArray(body) ? (body as SyncConflict[]) : []);
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
    }, [fetchKey]);

    const resolveConflict = useCallback(
        async (id: string) => {
            try {
                const response = await apiFetch(`/api/daemon/conflicts/${encodeURIComponent(id)}/resolve`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ strategy: "accept_server" }),
                });
                if (!response.ok) {
                    throw new Error(`Failed to resolve conflict (${response.status})`);
                }
                // Remove the resolved conflict from local state
                setConflicts((prev) => prev.filter((c) => c.id !== id));
            } catch (err) {
                setError(err instanceof Error ? err : new Error(String(err)));
            }
        },
        [],
    );

    const retryConflict = useCallback(
        async (id: string) => {
            try {
                const response = await apiFetch(`/api/daemon/conflicts/${encodeURIComponent(id)}/retry`, {
                    method: "POST",
                });
                if (!response.ok) {
                    throw new Error(`Failed to retry conflict (${response.status})`);
                }
                // Re-fetch to get updated list
                refetch();
            } catch (err) {
                setError(err instanceof Error ? err : new Error(String(err)));
            }
        },
        [refetch],
    );

    return { conflicts, loading, error, refetch, resolveConflict, retryConflict };
}
