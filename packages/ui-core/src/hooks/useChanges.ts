import { createResource } from "solid-js";
import { repoApiFetch } from "../api/client";
import type { RepoContext, RepoChange } from "../api/types";

export type UseChangesResult = {
    changes: () => RepoChange[] | undefined;
    loading: () => boolean;
    error: () => Error | undefined;
    refetch: () => void;
};

async function fetchChanges(context: RepoContext): Promise<RepoChange[]> {
    const response = await repoApiFetch("/changes?per_page=100", {}, context);
    if (!response.ok) {
        throw new Error(`Failed to load changes (${response.status})`);
    }
    const body = await response.json();
    return Array.isArray(body) ? (body as RepoChange[]) : [];
}

export function useChanges(repo: () => RepoContext): UseChangesResult {
    const [data, { refetch }] = createResource(repo, fetchChanges);

    return {
        changes: () => data(),
        loading: () => data.loading,
        error: () => data.error as Error | undefined,
        refetch,
    };
}
