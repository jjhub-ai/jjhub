import { createResource } from "solid-js";
import { repoApiFetch } from "../api/client";
import type { RepoContext, LandingSummary } from "../api/types";

export type UseLandingsResult = {
    landings: () => LandingSummary[] | undefined;
    loading: () => boolean;
    error: () => Error | undefined;
    refetch: () => void;
};

async function fetchLandings(context: RepoContext): Promise<LandingSummary[]> {
    const response = await repoApiFetch("/landings?per_page=100", {}, context);
    if (!response.ok) {
        throw new Error(`Failed to load landing requests (${response.status})`);
    }
    const body = await response.json();
    return Array.isArray(body) ? (body as LandingSummary[]) : [];
}

export function useLandings(repo: () => RepoContext): UseLandingsResult {
    const [data, { refetch }] = createResource(repo, fetchLandings);

    return {
        landings: () => data(),
        loading: () => data.loading,
        error: () => data.error as Error | undefined,
        refetch,
    };
}
