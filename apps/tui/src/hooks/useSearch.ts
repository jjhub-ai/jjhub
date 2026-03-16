import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@jjhub/ui-core";
import type { SearchRepoResult } from "@jjhub/ui-core";

export type UseSearchResult = {
    results: SearchRepoResult[] | undefined;
    loading: boolean;
    error: Error | undefined;
    refetch: () => void;
};

export function useSearch(query: string): UseSearchResult {
    const [results, setResults] = useState<SearchRepoResult[] | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | undefined>(undefined);
    const [fetchKey, setFetchKey] = useState(0);

    const refetch = useCallback(() => {
        setFetchKey((k) => k + 1);
    }, []);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(undefined);

        const params = new URLSearchParams({ q: query, page: "1", per_page: "30" });
        apiFetch(`/api/search/repositories?${params.toString()}`)
            .then(async (response) => {
                if (cancelled) return;
                if (!response.ok) {
                    const body = await response.json().catch(() => null);
                    throw new Error(
                        (body as { message?: string })?.message ||
                            `Search failed (${response.status})`,
                    );
                }
                const body = (await response.json()) as {
                    items: SearchRepoResult[];
                    total_count: number;
                };
                setResults(Array.isArray(body.items) ? body.items : []);
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
    }, [query, fetchKey]);

    return { results, loading, error, refetch };
}
