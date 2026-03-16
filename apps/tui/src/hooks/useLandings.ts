import { useState, useEffect, useCallback } from "react";
import { repoApiFetch } from "@jjhub/ui-core";
import type { LandingSummary, RepoContext } from "@jjhub/ui-core";

export type UseLandingsResult = {
    landings: LandingSummary[] | undefined;
    loading: boolean;
    error: Error | undefined;
    refetch: () => void;
};

export function useLandings(context: RepoContext): UseLandingsResult {
    const [landings, setLandings] = useState<LandingSummary[] | undefined>(undefined);
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

        repoApiFetch("/landings?per_page=100", {}, context)
            .then(async (response) => {
                if (cancelled) return;
                if (!response.ok) {
                    throw new Error(`Failed to load landing requests (${response.status})`);
                }
                const body = await response.json();
                setLandings(Array.isArray(body) ? (body as LandingSummary[]) : []);
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

    return { landings, loading, error, refetch };
}
