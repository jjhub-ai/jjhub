import { createResource } from "solid-js";
import { apiFetch } from "../api/client";
import type { UserRepoSummary, UserRepoListPage } from "../api/types";

export type UseReposResult = {
    repos: () => UserRepoSummary[] | undefined;
    loading: () => boolean;
    error: () => Error | undefined;
    refetch: () => void;
};

async function fetchRepos(): Promise<UserRepoSummary[]> {
    const params = new URLSearchParams({
        page: "1",
        per_page: "100",
    });
    const response = await apiFetch(`/api/user/repos?${params.toString()}`);
    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || `Failed to load repositories (${response.status})`);
    }
    const items = (await response.json()) as UserRepoSummary[];
    return Array.isArray(items) ? items : [];
}

export function useRepos(): UseReposResult {
    const [data, { refetch }] = createResource(fetchRepos);

    return {
        repos: () => data(),
        loading: () => data.loading,
        error: () => data.error as Error | undefined,
        refetch,
    };
}
