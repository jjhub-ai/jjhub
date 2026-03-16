import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import { Play, CheckCircle2, XCircle, Clock, Timer, Loader2, GitCommit, Search, X, RefreshCw } from "lucide-solid";
import { repoApiFetch } from "../../lib/repoContext";
import {
    workflowDefinitionsResource,
    type WorkflowDefinition,
    type WorkflowRun,
    type WorkflowWithLatestRun,
} from "../../lib/navigationData";
import "./WorkflowsList.css";

type WorkflowRunsResponse = {
    workflow_runs: WorkflowRun[];
};

type DispatchInputDef = {
    description?: string;
    required?: boolean;
    default?: string;
    type?: string;
    options?: string[];
};

function formatRelative(timestamp: string): string {
    const parsed = Date.parse(timestamp);
    if (Number.isNaN(parsed)) {
        return "recently";
    }
    const minutes = Math.max(1, Math.floor((Date.now() - parsed) / 60000));
    if (minutes < 60) {
        return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours}h ago`;
    }
    return `${Math.floor(hours / 24)}d ago`;
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
    if (!startedAt) {
        return "n/a";
    }
    const start = Date.parse(startedAt);
    const end = Date.parse(completedAt ?? new Date().toISOString());
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
        return "n/a";
    }
    const totalSeconds = Math.floor((end - start) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
}

/** Extract workflow_dispatch input definitions from config JSON. */
function getDispatchInputs(config: any): Record<string, DispatchInputDef> | null {
    if (!config) return null;
    const on = config.on ?? config.trigger ?? config.triggers;
    if (!on) return null;
    // Handle "on: workflow_dispatch" (no inputs) vs "on: { workflow_dispatch: { inputs: {...} } }"
    if (typeof on === "string" && on === "workflow_dispatch") return {};
    if (Array.isArray(on) && on.includes("workflow_dispatch")) return {};
    const dispatch = on.workflow_dispatch ?? on.dispatch;
    if (!dispatch) return null;
    return (dispatch.inputs as Record<string, DispatchInputDef>) ?? {};
}

export default function WorkflowsList() {
    const params = useParams<{ owner: string; repo: string }>();
    const context = () => ({ owner: params.owner ?? "", repo: params.repo ?? "" });
    const navigate = useNavigate();
    const initialBundle = workflowDefinitionsResource.peek(context());
    const [activeTab, setActiveTab] = createSignal<"definitions" | "runs">("definitions");
    const [workflows, setWorkflows] = createSignal<WorkflowWithLatestRun[]>(initialBundle?.workflows ?? []);
    const [allRuns, setAllRuns] = createSignal<WorkflowRun[]>([]);
    const [isLoading, setIsLoading] = createSignal(initialBundle === undefined);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [searchQuery, setSearchQuery] = createSignal("");

    // Dispatch dialog state
    const [dispatchTarget, setDispatchTarget] = createSignal<WorkflowDefinition | null>(null);
    const [dispatchRef, setDispatchRef] = createSignal("main");
    const [dispatchInputs, setDispatchInputs] = createSignal<Record<string, string>>({});
    const [isDispatching, setIsDispatching] = createSignal(false);
    const [dispatchError, setDispatchError] = createSignal<string | null>(null);

    // Map of workflow definition IDs to names for the all-runs tab
    const [workflowNames, setWorkflowNames] = createSignal<Map<number, string>>(
        new Map(initialBundle?.workflowNames ?? []),
    );

    const filteredWorkflows = createMemo(() => {
        const query = searchQuery().trim().toLowerCase();
        if (!query) {
            return workflows();
        }
        return workflows().filter(({ workflow, latestRun }) => {
            return (
                workflow.name.toLowerCase().includes(query) ||
                workflow.path.toLowerCase().includes(query) ||
                (latestRun?.trigger_ref ?? "").toLowerCase().includes(query) ||
                (latestRun?.trigger_event ?? "").toLowerCase().includes(query)
            );
        });
    });

    const filteredRuns = createMemo(() => {
        const query = searchQuery().trim().toLowerCase();
        if (!query) {
            return allRuns();
        }
        return allRuns().filter((run) => {
            const wfName = workflowNames().get(run.workflow_definition_id) ?? "";
            return (
                wfName.toLowerCase().includes(query) ||
                run.trigger_event.toLowerCase().includes(query) ||
                run.trigger_ref.toLowerCase().includes(query) ||
                run.status.toLowerCase().includes(query)
            );
        });
    });

    async function loadDefinitions() {
        const cachedBundle = workflowDefinitionsResource.peek(context());
        if (cachedBundle) {
            setWorkflows(cachedBundle.workflows);
            setWorkflowNames(new Map(cachedBundle.workflowNames));
        }

        setIsLoading(!cachedBundle);
        setErrorMessage(null);
        try {
            const bundle = await workflowDefinitionsResource.load(context());
            setWorkflows(bundle.workflows);
            setWorkflowNames(new Map(bundle.workflowNames));
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load workflows";
            setErrorMessage(message);
            setWorkflows([]);
        } finally {
            setIsLoading(false);
        }
    }

    async function loadAllRuns() {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const resp = await repoApiFetch("/actions/runs?per_page=50", {}, context());
            if (!resp.ok) {
                throw new Error(`Failed to load runs (${resp.status})`);
            }
            const body = (await resp.json()) as WorkflowRunsResponse;
            setAllRuns(Array.isArray(body.workflow_runs) ? body.workflow_runs : []);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load runs";
            setErrorMessage(message);
            setAllRuns([]);
        } finally {
            setIsLoading(false);
        }
    }

    onMount(() => {
        void loadDefinitions();
    });

    function switchTab(tab: "definitions" | "runs") {
        setActiveTab(tab);
        setSearchQuery("");
        if (tab === "runs" && allRuns().length === 0) {
            void loadAllRuns();
        }
    }

    function openDispatchDialog(workflow: WorkflowDefinition) {
        const inputs = getDispatchInputs(workflow.config);
        if (inputs === null) {
            // No workflow_dispatch trigger configured -- dispatch anyway with defaults
        }
        setDispatchTarget(workflow);
        setDispatchRef("main");
        setDispatchError(null);

        // Pre-fill default values
        const defaults: Record<string, string> = {};
        if (inputs) {
            for (const [key, def] of Object.entries(inputs)) {
                defaults[key] = def.default ?? "";
            }
        }
        setDispatchInputs(defaults);
    }

    function closeDispatchDialog() {
        setDispatchTarget(null);
        setDispatchError(null);
        setIsDispatching(false);
    }

    async function submitDispatch() {
        const target = dispatchTarget();
        if (!target) return;

        setIsDispatching(true);
        setDispatchError(null);

        try {
            const inputValues: Record<string, any> = {};
            for (const [key, value] of Object.entries(dispatchInputs())) {
                if (value !== "") {
                    inputValues[key] = value;
                }
            }

            const resp = await repoApiFetch(`/workflows/${target.id}/dispatches`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ref: dispatchRef(),
                    inputs: inputValues,
                }),
            }, context());

            if (!resp.ok && resp.status !== 204) {
                const body = await resp.json().catch(() => ({}));
                throw new Error((body as any).message ?? `Dispatch failed (${resp.status})`);
            }

            closeDispatchDialog();
            // Refresh the list
            if (activeTab() === "definitions") {
                void loadDefinitions();
            } else {
                void loadAllRuns();
            }
        } catch (error) {
            setDispatchError(error instanceof Error ? error.message : "Dispatch failed");
        } finally {
            setIsDispatching(false);
        }
    }

    function navigateToRun(runID: number) {
        navigate(`/${context().owner}/${context().repo}/workflows/runs/${runID}`);
    }

    const getStatusIcon = (status: string | null) => {
        if (!status) return <Clock size={16} class="text-muted" />;
        switch (status) {
            case "success":
                return <CheckCircle2 size={16} class="text-green" />;
            case "failed":
            case "cancelled":
            case "timeout":
                return <XCircle size={16} class="text-red" />;
            case "running":
                return <Loader2 size={16} class="text-blue animate-spin" />;
            case "queued":
                return <Clock size={16} class="text-muted" />;
            default:
                return <Clock size={16} class="text-muted" />;
        }
    };

    return (
        <div class="workflows-container">
            <header class="workflows-header animate-in stagger-1">
                <div class="header-main">
                    <h1>Workflows</h1>
                    <p class="text-muted">Monitor workflow definitions and runs in this repository.</p>
                </div>

                <div class="header-actions">
                    <button
                        class="secondary-btn"
                        onClick={() => activeTab() === "definitions" ? void loadDefinitions() : void loadAllRuns()}
                        title="Refresh"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </header>

            <div class="workflows-toolbar animate-in stagger-2">
                <div class="tab-list">
                    <button
                        class={`tab-btn ${activeTab() === "definitions" ? "active" : ""}`}
                        onClick={() => switchTab("definitions")}
                    >
                        Definitions
                    </button>
                    <button
                        class={`tab-btn ${activeTab() === "runs" ? "active" : ""}`}
                        onClick={() => switchTab("runs")}
                    >
                        All Runs
                    </button>
                </div>
                <div class="filter-actions">
                    <div class="search-wrap">
                        <Search size={14} class="search-icon text-muted" />
                        <input
                            type="text"
                            placeholder={activeTab() === "definitions" ? "Filter workflows..." : "Filter runs..."}
                            class="search-input"
                            value={searchQuery()}
                            onInput={(event) => setSearchQuery(event.currentTarget.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Definitions Tab */}
            <Show when={activeTab() === "definitions"}>
                <div class="runs-list animate-in stagger-3">
                    <div class="runs-list-header text-xs text-muted font-semibold uppercase tracking-wider">
                        <div class="col-status">Status</div>
                        <div class="col-workflow">Workflow</div>
                        <div class="col-commit">Latest Trigger</div>
                        <div class="col-timing">Duration</div>
                        <div class="col-actions">Actions</div>
                    </div>

                    <div class="runs-grid">
                        <Show when={isLoading()}>
                            <div class="run-row">
                                <div class="col-workflow text-muted">Loading workflows...</div>
                            </div>
                        </Show>

                        <Show when={errorMessage()}>
                            {(message) => (
                                <div class="run-row">
                                    <div class="col-workflow text-red">{message()}</div>
                                </div>
                            )}
                        </Show>

                        <Show when={!isLoading() && errorMessage() === null && filteredWorkflows().length === 0}>
                            <div class="run-row">
                                <div class="col-workflow text-muted">No workflows found for this repository.</div>
                            </div>
                        </Show>

                        <For each={filteredWorkflows()}>
                            {({ workflow, latestRun }) => (
                                <div
                                    class="run-row group"
                                    onClick={() => latestRun ? navigateToRun(latestRun.id) : undefined}
                                >
                                    <div class="col-status">
                                        <div class={`status-badge ${latestRun?.status ?? "queued"}`}>{getStatusIcon(latestRun?.status ?? null)}</div>
                                    </div>

                                    <div class="col-workflow">
                                        <div class="workflow-name-row">
                                            <span class="workflow-id text-muted">#{workflow.id}</span>
                                            <h3 class="workflow-title group-hover:text-blue transition-colors">{workflow.name}</h3>
                                        </div>
                                        <div class="run-meta">
                                            <span class="actor-tag">{workflow.is_active ? "active" : "inactive"}</span>
                                            <span class="text-muted">{workflow.path}</span>
                                        </div>
                                    </div>

                                    <div class="col-commit">
                                        <div class="commit-message truncate" title={latestRun?.trigger_event ?? "No runs yet"}>
                                            {latestRun?.trigger_event ?? "No runs yet"}
                                        </div>
                                        <div class="commit-meta">
                                            <GitCommit size={12} class="text-muted" />
                                            <span class="commit-hash">{(latestRun?.trigger_commit_sha ?? "n/a").slice(0, 7)}</span>
                                            <span class="branch-tag">{latestRun?.trigger_ref || "n/a"}</span>
                                        </div>
                                    </div>

                                    <div class="col-timing">
                                        <div class="timing-row">
                                            <Timer size={14} class="text-muted" />
                                            <span>{latestRun ? formatDuration(latestRun.started_at, latestRun.completed_at) : "n/a"}</span>
                                        </div>
                                        <div class="text-xs text-muted mt-1">{latestRun ? formatRelative(latestRun.created_at) : "never run"}</div>
                                    </div>

                                    <div class="col-actions" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            class="dispatch-btn"
                                            onClick={() => openDispatchDialog(workflow)}
                                            title="Run workflow manually"
                                        >
                                            <Play size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </div>
            </Show>

            {/* All Runs Tab */}
            <Show when={activeTab() === "runs"}>
                <div class="runs-list animate-in stagger-3">
                    <div class="runs-list-header text-xs text-muted font-semibold uppercase tracking-wider">
                        <div class="col-status">Status</div>
                        <div class="col-workflow">Run</div>
                        <div class="col-commit">Trigger</div>
                        <div class="col-timing">Duration</div>
                    </div>

                    <div class="runs-grid">
                        <Show when={isLoading()}>
                            <div class="run-row">
                                <div class="col-workflow text-muted">Loading runs...</div>
                            </div>
                        </Show>

                        <Show when={errorMessage()}>
                            {(message) => (
                                <div class="run-row">
                                    <div class="col-workflow text-red">{message()}</div>
                                </div>
                            )}
                        </Show>

                        <Show when={!isLoading() && errorMessage() === null && filteredRuns().length === 0}>
                            <div class="run-row">
                                <div class="col-workflow text-muted">No workflow runs found for this repository.</div>
                            </div>
                        </Show>

                        <For each={filteredRuns()}>
                            {(run) => (
                                <div class="run-row group" onClick={() => navigateToRun(run.id)}>
                                    <div class="col-status">
                                        <div class={`status-badge ${run.status}`}>{getStatusIcon(run.status)}</div>
                                    </div>

                                    <div class="col-workflow">
                                        <div class="workflow-name-row">
                                            <span class="workflow-id text-muted">#{run.id}</span>
                                            <h3 class="workflow-title group-hover:text-blue transition-colors">
                                                {workflowNames().get(run.workflow_definition_id) ?? `Workflow #${run.workflow_definition_id}`}
                                            </h3>
                                        </div>
                                        <div class="run-meta">
                                            <span class="actor-tag">{run.status}</span>
                                        </div>
                                    </div>

                                    <div class="col-commit">
                                        <div class="commit-message truncate" title={run.trigger_event}>
                                            {run.trigger_event}
                                        </div>
                                        <div class="commit-meta">
                                            <GitCommit size={12} class="text-muted" />
                                            <span class="commit-hash">{run.trigger_commit_sha.slice(0, 7)}</span>
                                            <span class="branch-tag">{run.trigger_ref || "n/a"}</span>
                                        </div>
                                    </div>

                                    <div class="col-timing">
                                        <div class="timing-row">
                                            <Timer size={14} class="text-muted" />
                                            <span>{formatDuration(run.started_at, run.completed_at)}</span>
                                        </div>
                                        <div class="text-xs text-muted mt-1">{formatRelative(run.created_at)}</div>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </div>
            </Show>

            {/* Dispatch Dialog */}
            <Show when={dispatchTarget()}>
                {(target) => {
                    const inputs = () => getDispatchInputs(target().config) ?? {};
                    const inputEntries = () => Object.entries(inputs());

                    return (
                        <div class="dispatch-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeDispatchDialog(); }}>
                            <div class="dispatch-dialog animate-in">
                                <div class="dispatch-dialog-header">
                                    <h2>Run workflow</h2>
                                    <button class="dispatch-close" onClick={closeDispatchDialog}>
                                        <X size={18} />
                                    </button>
                                </div>

                                <div class="dispatch-dialog-body">
                                    <div class="dispatch-workflow-name">
                                        <Play size={14} class="text-blue" />
                                        <span>{target().name}</span>
                                    </div>

                                    <div class="dispatch-field">
                                        <label class="dispatch-label">Branch / Ref</label>
                                        <input
                                            type="text"
                                            class="dispatch-input"
                                            value={dispatchRef()}
                                            onInput={(e) => setDispatchRef(e.currentTarget.value)}
                                            placeholder="main"
                                        />
                                    </div>

                                    <Show when={inputEntries().length > 0}>
                                        <div class="dispatch-inputs-section">
                                            <h3 class="dispatch-inputs-heading">Inputs</h3>
                                            <For each={inputEntries()}>
                                                {([key, def]) => (
                                                    <div class="dispatch-field">
                                                        <label class="dispatch-label">
                                                            {key}
                                                            <Show when={def.required}>
                                                                <span class="dispatch-required"> *</span>
                                                            </Show>
                                                        </label>
                                                        <Show when={def.description}>
                                                            <span class="dispatch-description text-muted">{def.description}</span>
                                                        </Show>
                                                        <Show when={def.options && def.options.length > 0} fallback={
                                                            <input
                                                                type={def.type === "boolean" ? "text" : "text"}
                                                                class="dispatch-input"
                                                                value={dispatchInputs()[key] ?? ""}
                                                                onInput={(e) => setDispatchInputs((prev) => ({ ...prev, [key]: e.currentTarget.value }))}
                                                                placeholder={def.default ?? ""}
                                                            />
                                                        }>
                                                            <select
                                                                class="dispatch-input"
                                                                value={dispatchInputs()[key] ?? ""}
                                                                onChange={(e) => setDispatchInputs((prev) => ({ ...prev, [key]: e.currentTarget.value }))}
                                                            >
                                                                <For each={def.options!}>
                                                                    {(opt) => <option value={opt}>{opt}</option>}
                                                                </For>
                                                            </select>
                                                        </Show>
                                                    </div>
                                                )}
                                            </For>
                                        </div>
                                    </Show>

                                    <Show when={dispatchError()}>
                                        {(err) => (
                                            <div class="dispatch-error">
                                                <XCircle size={14} />
                                                <span>{err()}</span>
                                            </div>
                                        )}
                                    </Show>
                                </div>

                                <div class="dispatch-dialog-footer">
                                    <button class="secondary-btn" onClick={closeDispatchDialog}>
                                        Cancel
                                    </button>
                                    <button
                                        class="primary-btn"
                                        onClick={submitDispatch}
                                        disabled={isDispatching()}
                                    >
                                        <Play size={14} />
                                        {isDispatching() ? "Dispatching..." : "Run workflow"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                }}
            </Show>
        </div>
    );
}
