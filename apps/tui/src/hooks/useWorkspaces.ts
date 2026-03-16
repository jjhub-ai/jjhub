import { useState, useEffect, useCallback } from "react";
import { repoApiFetch, repoApiWrite } from "@jjhub/ui-core";
import type { RepoContext } from "@jjhub/ui-core";

export type WorkspaceStatus = "running" | "suspended" | "failed" | "creating" | "deleting";

export type WorkspaceService = {
    name: string;
    status: "running" | "stopped" | "error";
    port?: number;
};

export type WorkspaceSummary = {
    id: string;
    name: string;
    status: WorkspaceStatus;
    bookmark: string;
    last_activity: string;
    created_at: string;
};

export type WorkspaceDetailData = {
    id: string;
    name: string;
    status: WorkspaceStatus;
    bookmark: string;
    created_at: string;
    last_activity: string;
    services: WorkspaceService[];
    ssh_url: string;
};

export type UseWorkspacesResult = {
    workspaces: WorkspaceSummary[] | undefined;
    loading: boolean;
    error: Error | undefined;
    refetch: () => void;
    suspend: (id: string) => Promise<void>;
    resume: (id: string) => Promise<void>;
    remove: (id: string) => Promise<void>;
    create: (bookmark: string) => Promise<void>;
};

export function useWorkspaces(context: RepoContext): UseWorkspacesResult {
    const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | undefined>(undefined);
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

        repoApiFetch("/workspaces?per_page=100", {}, context)
            .then(async (response) => {
                if (cancelled) return;
                if (!response.ok) {
                    throw new Error(`Failed to load workspaces (${response.status})`);
                }
                const body = await response.json();
                setWorkspaces(Array.isArray(body) ? (body as WorkspaceSummary[]) : []);
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

    const suspend = useCallback(
        async (id: string) => {
            const res = await repoApiWrite(`/workspaces/${id}/suspend`, {}, context, "POST");
            if (!res.ok) {
                throw new Error(`Failed to suspend workspace (${res.status})`);
            }
            refetch();
        },
        [context.owner, context.repo, refetch],
    );

    const resume = useCallback(
        async (id: string) => {
            const res = await repoApiWrite(`/workspaces/${id}/resume`, {}, context, "POST");
            if (!res.ok) {
                throw new Error(`Failed to resume workspace (${res.status})`);
            }
            refetch();
        },
        [context.owner, context.repo, refetch],
    );

    const remove = useCallback(
        async (id: string) => {
            const res = await repoApiFetch(
                `/workspaces/${id}`,
                { method: "DELETE" },
                context,
            );
            if (!res.ok) {
                throw new Error(`Failed to delete workspace (${res.status})`);
            }
            refetch();
        },
        [context.owner, context.repo, refetch],
    );

    const create = useCallback(
        async (bookmark: string) => {
            const res = await repoApiWrite("/workspaces", { bookmark }, context, "POST");
            if (!res.ok) {
                throw new Error(`Failed to create workspace (${res.status})`);
            }
            refetch();
        },
        [context.owner, context.repo, refetch],
    );

    return { workspaces, loading, error, refetch, suspend, resume, remove, create };
}

export type UseWorkspaceDetailResult = {
    workspace: WorkspaceDetailData | undefined;
    loading: boolean;
    error: Error | undefined;
    refetch: () => void;
};

export function useWorkspaceDetail(
    context: RepoContext,
    workspaceId: string,
): UseWorkspaceDetailResult {
    const [workspace, setWorkspace] = useState<WorkspaceDetailData | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | undefined>(undefined);
    const [fetchKey, setFetchKey] = useState(0);

    const refetch = useCallback(() => {
        setFetchKey((k) => k + 1);
    }, []);

    useEffect(() => {
        if (!workspaceId) return;

        let cancelled = false;
        setLoading(true);
        setError(undefined);

        repoApiFetch(`/workspaces/${workspaceId}`, {}, context)
            .then(async (response) => {
                if (cancelled) return;
                if (!response.ok) {
                    throw new Error(`Failed to load workspace (${response.status})`);
                }
                const body = (await response.json()) as WorkspaceDetailData;
                setWorkspace(body);
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
    }, [context.owner, context.repo, workspaceId, fetchKey]);

    return { workspace, loading, error, refetch };
}
