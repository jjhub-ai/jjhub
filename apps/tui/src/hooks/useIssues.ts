import { useState, useEffect, useCallback } from "react";
import { repoApiFetch } from "@jjhub/ui-core";
import type { IssueSummary, RepoContext } from "@jjhub/ui-core";

export type UseIssuesResult = {
    issues: IssueSummary[] | undefined;
    loading: boolean;
    error: Error | undefined;
    refetch: () => void;
};

export function useIssues(context: RepoContext): UseIssuesResult {
    const [issues, setIssues] = useState<IssueSummary[] | undefined>(undefined);
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

        repoApiFetch("/issues?per_page=100", {}, context)
            .then(async (response) => {
                if (cancelled) return;
                if (!response.ok) {
                    throw new Error(`Failed to load issues (${response.status})`);
                }
                const body = await response.json();
                setIssues(Array.isArray(body) ? (body as IssueSummary[]) : []);
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

    return { issues, loading, error, refetch };
}
