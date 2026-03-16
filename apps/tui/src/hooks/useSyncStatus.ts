import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "@jjhub/ui-core";

export type SyncState = "online" | "offline" | "syncing";

export type SyncStatusData = {
    status: SyncState;
    pending: number;
    conflicts: number;
    lastSync: string | null;
    remote: string | null;
};

export type UseSyncStatusResult = {
    data: SyncStatusData;
    loading: boolean;
    error: Error | undefined;
    triggerSync: () => Promise<void>;
};

const DEFAULT_STATUS: SyncStatusData = {
    status: "offline",
    pending: 0,
    conflicts: 0,
    lastSync: null,
    remote: null,
};

const POLL_INTERVAL_MS = 5000;

export function useSyncStatus(): UseSyncStatusResult {
    const [data, setData] = useState<SyncStatusData>(DEFAULT_STATUS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | undefined>(undefined);
    const mountedRef = useRef(true);

    const fetchStatus = useCallback(async () => {
        try {
            const response = await apiFetch("/api/daemon/status");
            if (!mountedRef.current) return;

            if (!response.ok) {
                throw new Error(`Failed to fetch sync status (${response.status})`);
            }

            const body = (await response.json()) as SyncStatusData;
            setData({
                status: body.status ?? "offline",
                pending: body.pending ?? 0,
                conflicts: body.conflicts ?? 0,
                lastSync: body.lastSync ?? null,
                remote: body.remote ?? null,
            });
            setError(undefined);
        } catch (err) {
            if (!mountedRef.current) return;
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, []);

    const triggerSync = useCallback(async () => {
        try {
            setData((prev) => ({ ...prev, status: "syncing" }));
            const response = await apiFetch("/api/daemon/sync", { method: "POST" });
            if (!mountedRef.current) return;

            if (!response.ok) {
                throw new Error(`Sync failed (${response.status})`);
            }

            // Re-fetch status after triggering sync
            await fetchStatus();
        } catch (err) {
            if (!mountedRef.current) return;
            setError(err instanceof Error ? err : new Error(String(err)));
        }
    }, [fetchStatus]);

    useEffect(() => {
        mountedRef.current = true;
        fetchStatus();

        const interval = setInterval(fetchStatus, POLL_INTERVAL_MS);

        return () => {
            mountedRef.current = false;
            clearInterval(interval);
        };
    }, [fetchStatus]);

    return { data, loading, error, triggerSync };
}
