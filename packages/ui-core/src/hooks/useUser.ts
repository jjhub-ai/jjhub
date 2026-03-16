import { createResource } from "solid-js";
import { apiFetch } from "../api/client";
import type { CurrentUser } from "../api/types";

export type UseUserResult = {
    user: () => CurrentUser | undefined;
    loading: () => boolean;
    error: () => Error | undefined;
    refetch: () => void;
};

async function fetchUser(): Promise<CurrentUser> {
    const response = await apiFetch("/api/user");
    if (!response.ok) {
        throw new Error(`Failed to load user (${response.status})`);
    }
    return (await response.json()) as CurrentUser;
}

export function useUser(): UseUserResult {
    const [data, { refetch }] = createResource(fetchUser);

    return {
        user: () => data(),
        loading: () => data.loading,
        error: () => data.error as Error | undefined,
        refetch,
    };
}
