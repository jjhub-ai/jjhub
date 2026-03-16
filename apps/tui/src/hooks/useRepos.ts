import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@jjhub/ui-core";
import type { UserRepoSummary } from "@jjhub/ui-core";

export type UseReposResult = {
    repos: UserRepoSummary[] | undefined;
    loading: boolean;
    error: Error | undefined;
    refetch: () => void;
};

export function useRepos(): UseReposResult {
    const [repos, setRepos] = useState<UserRepoSummary[] | undefined>(undefined);
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

        const params = new URLSearchParams({ page: "1", per_page: "100" });
        apiFetch(`/api/user/repos?${params.toString()}`)
            .then(async (response) => {
                if (cancelled) return;
                if (!response.ok) {
                    const body = await response.json().catch(() => null);
                    throw new Error(
                        (body as { message?: string })?.message ||
                            `Failed to load repositories (${response.status})`,
                    );
                }
                const items = (await response.json()) as UserRepoSummary[];
                setRepos(Array.isArray(items) ? items : []);
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

    return { repos, loading, error, refetch };
}
