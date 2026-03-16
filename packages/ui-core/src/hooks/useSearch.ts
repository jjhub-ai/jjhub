import { createResource } from "solid-js";
import { apiFetch } from "../api/client";
import type { SearchRepoResult } from "../api/types";

export type UseSearchResult = {
    results: () => SearchRepoResult[] | undefined;
    loading: () => boolean;
    error: () => Error | undefined;
    refetch: () => void;
};

async function fetchSearch(query: string): Promise<SearchRepoResult[]> {
    if (!query.trim()) {
        return [];
    }

    const params = new URLSearchParams({
        q: query,
        page: "1",
        per_page: "30",
    });
    const response = await apiFetch(`/api/search/repositories?${params.toString()}`);
    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || `Search failed (${response.status})`);
    }

    const body = (await response.json()) as { items: SearchRepoResult[]; total_count: number };
    return Array.isArray(body.items) ? body.items : [];
}

export function useSearch(query: () => string): UseSearchResult {
    const [data, { refetch }] = createResource(query, fetchSearch);

    return {
        results: () => data(),
        loading: () => data.loading,
        error: () => data.error as Error | undefined,
        refetch,
    };
}
