import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@jjhub/ui-core";
import type { UserRepoSummary, RepoContext } from "@jjhub/ui-core";

export type UseRepoDetailResult = {
    repo: UserRepoSummary | undefined;
    loading: boolean;
    error: Error | undefined;
    refetch: () => void;
};

export function useRepoDetail(context: RepoContext): UseRepoDetailResult {
    const [repo, setRepo] = useState<UserRepoSummary | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | undefined>(undefined);
    const [fetchKey, setFetchKey] = useState(0);

    const refetch = useCallback(() => {
        setFetchKey((k) => k + 1);
    }, []);

    useEffect(() => {
        if (!context.owner || !context.repo) return;

        let cancelled = false;
        setLoading(true);
        setError(undefined);

        apiFetch(
            `/api/repos/${encodeURIComponent(context.owner)}/${encodeURIComponent(context.repo)}`,
        )
            .then(async (response) => {
                if (cancelled) return;
                if (!response.ok) {
                    const body = await response.json().catch(() => null);
                    throw new Error(
                        (body as { message?: string })?.message ||
                            `Failed to load repository (${response.status})`,
                    );
                }
                const data = (await response.json()) as UserRepoSummary;
                setRepo(data);
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

    return { repo, loading, error, refetch };
}
