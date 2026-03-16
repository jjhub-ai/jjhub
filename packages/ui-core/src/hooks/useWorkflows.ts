import { createResource } from "solid-js";
import { repoApiFetch } from "../api/client";
import type {
    RepoContext,
    WorkflowDefinition,
    WorkflowRun,
    WorkflowWithLatestRun,
} from "../api/types";

export type UseWorkflowsResult = {
    workflows: () => WorkflowWithLatestRun[] | undefined;
    runs: () => WorkflowRun[] | undefined;
    loading: () => boolean;
    error: () => Error | undefined;
    refetch: () => void;
};

type WorkflowsData = {
    workflows: WorkflowWithLatestRun[];
    runs: WorkflowRun[];
};

async function fetchWorkflows(context: RepoContext): Promise<WorkflowsData> {
    const workflowResponse = await repoApiFetch("/workflows?per_page=100", {}, context);
    if (!workflowResponse.ok) {
        throw new Error(`Failed to load workflows (${workflowResponse.status})`);
    }

    const body = (await workflowResponse.json()) as { workflows: WorkflowDefinition[] };
    const definitions = Array.isArray(body.workflows) ? body.workflows : [];

    const workflows = await Promise.all(
        definitions.map(async (workflow) => {
            const runsResponse = await repoApiFetch(
                `/workflows/${workflow.id}/runs?per_page=1`,
                {},
                context,
            );
            if (!runsResponse.ok) {
                return { workflow, latestRun: null };
            }

            const runsBody = (await runsResponse.json()) as { workflow_runs: WorkflowRun[] };
            return {
                workflow,
                latestRun: Array.isArray(runsBody.workflow_runs)
                    ? runsBody.workflow_runs[0] ?? null
                    : null,
            };
        }),
    );

    const runs = workflows
        .map((w) => w.latestRun)
        .filter((r): r is WorkflowRun => r !== null);

    return { workflows, runs };
}

export function useWorkflows(repo: () => RepoContext): UseWorkflowsResult {
    const [data, { refetch }] = createResource(repo, fetchWorkflows);

    return {
        workflows: () => data()?.workflows,
        runs: () => data()?.runs,
        loading: () => data.loading,
        error: () => data.error as Error | undefined,
        refetch,
    };
}
