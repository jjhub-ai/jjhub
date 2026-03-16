import { createSignal, createResource } from "solid-js";
import { apiFetch, repoApiFetch } from "../api/client";
import type { RepoContext, IssueSummary } from "../api/types";

export type UseIssuesResult = {
    issues: () => IssueSummary[] | undefined;
    loading: () => boolean;
    error: () => Error | undefined;
    refetch: () => void;
};

async function fetchIssues(context: RepoContext): Promise<IssueSummary[]> {
    const response = await repoApiFetch("/issues?per_page=100", {}, context);
    if (!response.ok) {
        throw new Error(`Failed to load issues (${response.status})`);
    }
    const body = await response.json();
    return Array.isArray(body) ? (body as IssueSummary[]) : [];
}

export function useIssues(repo: () => RepoContext): UseIssuesResult {
    const [data, { refetch }] = createResource(repo, fetchIssues);

    return {
        issues: () => data(),
        loading: () => data.loading,
        error: () => data.error as Error | undefined,
        refetch,
    };
}
