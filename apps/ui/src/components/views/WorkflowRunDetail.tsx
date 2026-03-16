import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import {
    ArrowLeft,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Clock,
    GitCommit,
    Loader2,
    Play,
    RefreshCw,
    Square,
    Timer,
    XCircle,
} from "lucide-solid";
import { repoApiFetch, repoApiPath } from "../../lib/repoContext";
import { createAuthenticatedEventSource, type SSEClient } from "../../lib/authenticatedEventSource";
import "./WorkflowRunDetail.css";

type WorkflowRun = {
    id: number;
    repository_id: number;
    workflow_definition_id: number;
    status: "queued" | "running" | "success" | "failure" | "failed" | "cancelled" | "timeout" | string;
    trigger_event: string;
    trigger_ref: string;
    trigger_commit_sha: string;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
};

type WorkflowStep = {
    id: number;
    workflow_run_id: number;
    name: string;
    position: number;
    status: "queued" | "running" | "success" | "failure" | "failed" | "cancelled" | "timeout" | "skipped" | string;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
};

type WorkflowDefinition = {
    id: number;
    name: string;
    path: string;
    is_active: boolean;
};

type LogLine = {
    log_id?: number;
    step: number;
    line: number;
    content: string;
    stream?: string;
};

type WorkflowRunStatusEvent = {
    run: WorkflowRun;
    steps: WorkflowStep[];
};

function formatRelative(timestamp: string, nowMs = Date.now()): string {
    const parsed = Date.parse(timestamp);
    if (Number.isNaN(parsed)) return "recently";
    const minutes = Math.max(1, Math.floor((nowMs - parsed) / 60000));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function formatDuration(startedAt: string | null, completedAt: string | null, nowMs = Date.now()): string {
    if (!startedAt) return "n/a";
    const start = Date.parse(startedAt);
    const end = Date.parse(completedAt ?? new Date(nowMs).toISOString());
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "n/a";
    const totalSeconds = Math.floor((end - start) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
}

function formatTimestamp(timestamp: string): string {
    const parsed = Date.parse(timestamp);
    if (Number.isNaN(parsed)) return "unknown";
    return new Date(parsed).toLocaleString();
}

function isTerminalStatus(status: string | null | undefined): boolean {
    return status === "success" || status === "failure" || status === "failed" || status === "cancelled" || status === "timeout";
}

export default function WorkflowRunDetail() {
    const params = useParams<{ owner: string; repo: string; id: string }>();
    const navigate = useNavigate();
    const context = () => ({ owner: params.owner ?? "", repo: params.repo ?? "" });

    const [run, setRun] = createSignal<WorkflowRun | null>(null);
    const [steps, setSteps] = createSignal<WorkflowStep[]>([]);
    const [workflow, setWorkflow] = createSignal<WorkflowDefinition | null>(null);
    const [logs, setLogs] = createSignal<Map<number, LogLine[]>>(new Map());
    const [expandedSteps, setExpandedSteps] = createSignal<Set<number>>(new Set());
    const [isLoading, setIsLoading] = createSignal(true);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [actionInProgress, setActionInProgress] = createSignal<string | null>(null);
    const [isStreaming, setIsStreaming] = createSignal(false);
    const [autoScroll, setAutoScroll] = createSignal(true);
    const [clockTick, setClockTick] = createSignal(Date.now());

    let eventSource: SSEClient | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let clockInterval: ReturnType<typeof setInterval> | null = null;
    const logContainers = new Map<number, HTMLDivElement>();

    const runID = () => params.id;
    const isTerminal = () => isTerminalStatus(run()?.status);
    const activeStep = createMemo(() => steps().find((step) => step.status === "running") ?? null);
    const completedStepCount = createMemo(() => steps().filter((step) => isTerminalStatus(step.status) || step.status === "skipped").length);

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    function scrollExpandedLogsToBottom() {
        for (const stepID of expandedSteps()) {
            const container = logContainers.get(stepID);
            if (!container) continue;
            container.scrollTop = container.scrollHeight;
        }
    }

    function applyStatusEvent(raw: string): boolean {
        try {
            const data = JSON.parse(raw) as WorkflowRunStatusEvent;
            if (data.run) {
                setRun(data.run);
            }
            if (Array.isArray(data.steps)) {
                setSteps(data.steps);
            }
            return true;
        } catch {
            return false;
        }
    }

    async function loadRunData() {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            // Fetch run detail
            const runResp = await repoApiFetch(`/actions/runs/${runID()}`, {}, context());
            if (!runResp.ok) throw new Error(`Failed to load run (${runResp.status})`);
            const runData = (await runResp.json()) as WorkflowRun;
            setRun(runData);

            // Fetch steps
            const stepsResp = await repoApiFetch(`/actions/runs/${runID()}/steps`, {}, context());
            if (stepsResp.ok) {
                const stepsBody = (await stepsResp.json()) as { steps: WorkflowStep[] };
                setSteps(Array.isArray(stepsBody.steps) ? stepsBody.steps : []);
            }

            // Fetch workflow definition
            const wfResp = await repoApiFetch(`/workflows/${runData.workflow_definition_id}`, {}, context());
            if (wfResp.ok) {
                const wfData = (await wfResp.json()) as WorkflowDefinition;
                setWorkflow(wfData);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load run details";
            setErrorMessage(message);
        } finally {
            setIsLoading(false);
        }
    }

    function startLogStream() {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }

        const url = repoApiPath(`/runs/${runID()}/logs`, context());
        const es = createAuthenticatedEventSource(url, { withCredentials: true });
        eventSource = es;
        setIsStreaming(true);

        es.addEventListener("log", (event: MessageEvent) => {
            setIsStreaming(true);
            stopPolling();
            try {
                const data = JSON.parse(event.data) as LogLine;
                setLogs((prev) => {
                    const next = new Map(prev);
                    const existing = next.get(data.step) ?? [];
                    // Avoid duplicates by checking sequence
                    if (!existing.some((l) => l.line === data.line)) {
                        next.set(data.step, [...existing, data].sort((a, b) => a.line - b.line));
                    }
                    return next;
                });
            } catch {
                // Ignore malformed log events
            }
        });

        es.addEventListener("status", (event: MessageEvent) => {
            setIsStreaming(true);
            stopPolling();
            if (!applyStatusEvent(event.data)) {
                void loadRunData();
            }
        });

        es.addEventListener("done", (event: MessageEvent) => {
            if (!applyStatusEvent(event.data)) {
                void loadRunData();
            }
            es.close();
            setIsStreaming(false);
            stopPolling();
        });

        es.onerror = () => {
            setIsStreaming(false);
            if (!isTerminal()) {
                startPolling();
            }
        };
    }

    function startPolling() {
        if (pollInterval || isTerminal()) return;
        pollInterval = setInterval(async () => {
            const currentRun = run();
            if (!currentRun || isTerminal()) {
                stopPolling();
                return;
            }
            try {
                const runResp = await repoApiFetch(`/actions/runs/${runID()}`, {}, context());
                if (runResp.ok) {
                    const updated = (await runResp.json()) as WorkflowRun;
                    setRun(updated);
                    if (isTerminalStatus(updated.status)) {
                        stopPolling();
                    }
                }
                const stepsResp = await repoApiFetch(`/actions/runs/${runID()}/steps`, {}, context());
                if (stepsResp.ok) {
                    const body = (await stepsResp.json()) as { steps: WorkflowStep[] };
                    setSteps(Array.isArray(body.steps) ? body.steps : []);
                }
            } catch {
                // Ignore polling errors
            }
        }, 5000);
    }

    onMount(() => {
        void loadRunData().then(() => {
            if (!isTerminal()) {
                startLogStream();
            }
        });
    });

    onCleanup(() => {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        stopPolling();
        if (clockInterval) {
            clearInterval(clockInterval);
            clockInterval = null;
        }
    });

    // Auto-expand first running/failed step
    createEffect(() => {
        const stepList = steps();
        if (stepList.length > 0 && expandedSteps().size === 0) {
            const target = stepList.find((s) => s.status === "running" || s.status === "failure" || s.status === "failed") ?? stepList[0];
            if (target) {
                setExpandedSteps(new Set([target.id]));
            }
        }
    });

    createEffect(() => {
        const hasLiveDurations = run()?.status === "running" || steps().some((step) => step.status === "running");
        if (!hasLiveDurations) {
            if (clockInterval) {
                clearInterval(clockInterval);
                clockInterval = null;
            }
            return;
        }
        if (clockInterval) {
            return;
        }
        clockInterval = setInterval(() => setClockTick(Date.now()), 1000);
    });

    createEffect(() => {
        logs();
        expandedSteps();
        if (!autoScroll()) {
            return;
        }
        queueMicrotask(scrollExpandedLogsToBottom);
    });

    function toggleStep(stepID: number) {
        setExpandedSteps((prev) => {
            const next = new Set(prev);
            if (next.has(stepID)) {
                next.delete(stepID);
            } else {
                next.add(stepID);
            }
            return next;
        });
    }

    function toggleAutoScroll() {
        const next = !autoScroll();
        setAutoScroll(next);
        if (next) {
            queueMicrotask(scrollExpandedLogsToBottom);
        }
    }

    async function handleCancel() {
        setActionInProgress("cancel");
        try {
            const resp = await repoApiFetch(`/actions/runs/${runID()}/cancel`, {
                method: "POST",
            }, context());
            if (!resp.ok && resp.status !== 204) {
                const body = await resp.json().catch(() => ({}));
                throw new Error((body as any).message ?? `Cancel failed (${resp.status})`);
            }
            await loadRunData();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Cancel failed");
        } finally {
            setActionInProgress(null);
        }
    }

    async function handleRerun() {
        setActionInProgress("rerun");
        try {
            const resp = await repoApiFetch(`/actions/runs/${runID()}/rerun`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
            }, context());
            if (!resp.ok) {
                const body = await resp.json().catch(() => ({}));
                throw new Error((body as any).message ?? `Rerun failed (${resp.status})`);
            }
            const result = (await resp.json()) as { workflow_run_id: number };
            // Navigate to the new run
            navigate(`/${context().owner}/${context().repo}/workflows/runs/${result.workflow_run_id}`);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Rerun failed");
        } finally {
            setActionInProgress(null);
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "success":
                return <CheckCircle2 size={16} class="text-green" />;
            case "failure":
            case "failed":
            case "cancelled":
            case "timeout":
                return <XCircle size={16} class="text-red" />;
            case "running":
                return <Loader2 size={16} class="text-blue animate-spin" />;
            case "skipped":
                return <Clock size={16} class="text-muted" />;
            case "queued":
                return <Clock size={16} class="text-muted" />;
            default:
                return <Clock size={16} class="text-muted" />;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "success": return "Succeeded";
            case "failure": return "Failed";
            case "failed": return "Failed";
            case "cancelled": return "Cancelled";
            case "timeout": return "Timed out";
            case "running": return "Running";
            case "skipped": return "Skipped";
            case "queued": return "Queued";
            default: return status;
        }
    };

    return (
        <div class="run-detail-container">
            {/* Header with back navigation */}
            <header class="run-detail-header animate-in stagger-1">
                <button class="back-btn" onClick={() => navigate(`/${context().owner}/${context().repo}/workflows`)}>
                    <ArrowLeft size={16} />
                    <span>Workflows</span>
                </button>

                <Show when={!isLoading() && run()}>
                    {(currentRun) => (
                        <div class="run-header-content">
                            <div class="run-header-main">
                                <div class="run-title-row">
                                    <div class={`run-status-badge ${currentRun().status}`}>
                                        {getStatusIcon(currentRun().status)}
                                        <span>{getStatusLabel(currentRun().status)}</span>
                                    </div>
                                    <h1>
                                        {workflow()?.name ?? `Workflow #${currentRun().workflow_definition_id}`}
                                        <span class="run-number text-muted"> #{currentRun().id}</span>
                                    </h1>
                                </div>

                                <div class="run-meta-row">
                                    <span class="meta-item">
                                        <Play size={12} class="text-muted" />
                                        {currentRun().trigger_event}
                                    </span>
                                    <span class="meta-item">
                                        <GitCommit size={12} class="text-muted" />
                                        <code>{currentRun().trigger_commit_sha.slice(0, 7)}</code>
                                    </span>
                                    <Show when={currentRun().trigger_ref}>
                                        <span class="branch-tag">{currentRun().trigger_ref}</span>
                                    </Show>
                                    <span class="meta-item">
                                        <Timer size={12} class="text-muted" />
                                        {formatDuration(currentRun().started_at, currentRun().completed_at, clockTick())}
                                    </span>
                                    <span class="meta-item text-muted">
                                        {formatRelative(currentRun().created_at, clockTick())}
                                    </span>
                                    <Show when={isStreaming()}>
                                        <span class="streaming-indicator">
                                            <span class="streaming-dot" />
                                            Live
                                        </span>
                                    </Show>
                                </div>
                            </div>

                            <div class="run-actions">
                                <Show when={!isTerminal()}>
                                    <button
                                        class="danger-btn"
                                        onClick={handleCancel}
                                        disabled={actionInProgress() !== null}
                                    >
                                        <Square size={14} />
                                        {actionInProgress() === "cancel" ? "Cancelling..." : "Cancel"}
                                    </button>
                                </Show>
                                <button
                                    class="secondary-btn"
                                    onClick={handleRerun}
                                    disabled={actionInProgress() !== null}
                                >
                                    <RefreshCw size={14} />
                                    {actionInProgress() === "rerun" ? "Rerunning..." : "Rerun"}
                                </button>
                            </div>
                        </div>
                    )}
                </Show>
            </header>

            {/* Error banner */}
            <Show when={errorMessage()}>
                {(msg) => (
                    <div class="run-error-banner animate-in stagger-2">
                        <XCircle size={16} class="text-red" />
                        <span>{msg()}</span>
                    </div>
                )}
            </Show>

            {/* Loading state */}
            <Show when={isLoading()}>
                <div class="run-loading animate-in stagger-2">
                    <Loader2 size={24} class="text-muted animate-spin" />
                    <span class="text-muted">Loading run details...</span>
                </div>
            </Show>

            {/* Steps and logs */}
            <Show when={!isLoading() && steps().length > 0}>
                <div class="run-steps animate-in stagger-2">
                    <div class="steps-heading-row">
                        <div>
                            <h2 class="steps-heading">Steps</h2>
                            <div class="steps-summary text-muted">
                                <span>{completedStepCount()} of {steps().length} finished</span>
                                <Show when={activeStep()}>
                                    {(step) => <span>Running: {step().name}</span>}
                                </Show>
                            </div>
                        </div>
                        <button
                            type="button"
                            class="secondary-btn auto-scroll-toggle"
                            aria-pressed={autoScroll()}
                            onClick={toggleAutoScroll}
                        >
                            {autoScroll() ? "Pause auto-scroll" : "Resume auto-scroll"}
                        </button>
                    </div>
                    <div class="step-progress-strip">
                        <For each={steps()}>
                            {(step) => (
                                <div class={`step-progress-chip ${step.status} ${activeStep()?.id === step.id ? "active" : ""}`}>
                                    {getStatusIcon(step.status)}
                                    <span>{step.name}</span>
                                </div>
                            )}
                        </For>
                    </div>
                    <div class="steps-list">
                        <For each={steps()}>
                            {(step) => {
                                const stepLogs = () => logs().get(step.id) ?? [];
                                const isExpanded = () => expandedSteps().has(step.id);
                                return (
                                    <div class={`step-card ${step.status}`}>
                                        <button class="step-header" onClick={() => toggleStep(step.id)}>
                                            <div class="step-header-left">
                                                <span class="step-expand-icon">
                                                    {isExpanded() ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                </span>
                                                <div class={`step-status-dot ${step.status}`}>
                                                    {getStatusIcon(step.status)}
                                                </div>
                                                <span class="step-name">{step.name}</span>
                                            </div>
                                            <div class="step-header-right">
                                                <span class="step-duration text-muted">
                                                    {formatDuration(step.started_at, step.completed_at, clockTick())}
                                                </span>
                                            </div>
                                        </button>

                                        <Show when={isExpanded()}>
                                            <div
                                                class="step-logs"
                                                ref={(element) => {
                                                    if (element) {
                                                        logContainers.set(step.id, element);
                                                    } else {
                                                        logContainers.delete(step.id);
                                                    }
                                                }}
                                            >
                                                <Show when={stepLogs().length === 0}>
                                                    <div class="step-logs-empty text-muted">
                                                        {step.status === "queued" ? "Waiting to start..." : "No log output yet."}
                                                    </div>
                                                </Show>
                                                <For each={stepLogs()}>
                                                    {(logLine) => (
                                                        <div class="log-line">
                                                            <span class="log-line-number">{logLine.line}</span>
                                                            <span class="log-line-content">{logLine.content}</span>
                                                        </div>
                                                    )}
                                                </For>
                                            </div>
                                        </Show>
                                    </div>
                                );
                            }}
                        </For>
                    </div>
                </div>
            </Show>

            {/* No steps state */}
            <Show when={!isLoading() && run() && steps().length === 0}>
                <div class="run-empty animate-in stagger-2">
                    <Clock size={24} class="text-muted" />
                    <span class="text-muted">No steps recorded for this run yet.</span>
                </div>
            </Show>

            {/* Run timing details */}
            <Show when={!isLoading() && run()}>
                {(currentRun) => (
                    <div class="run-timing-details animate-in stagger-3">
                        <h2 class="steps-heading">Timing</h2>
                        <div class="timing-grid">
                            <div class="timing-cell">
                                <span class="timing-label text-muted">Created</span>
                                <span class="timing-value">{formatTimestamp(currentRun().created_at)}</span>
                            </div>
                            <Show when={currentRun().started_at}>
                                {(startedAt) => (
                                    <div class="timing-cell">
                                        <span class="timing-label text-muted">Started</span>
                                        <span class="timing-value">{formatTimestamp(startedAt())}</span>
                                    </div>
                                )}
                            </Show>
                            <Show when={currentRun().completed_at}>
                                {(completedAt) => (
                                    <div class="timing-cell">
                                        <span class="timing-label text-muted">Completed</span>
                                        <span class="timing-value">{formatTimestamp(completedAt())}</span>
                                    </div>
                                )}
                            </Show>
                            <div class="timing-cell">
                                <span class="timing-label text-muted">Duration</span>
                                <span class="timing-value">{formatDuration(currentRun().started_at, currentRun().completed_at, clockTick())}</span>
                            </div>
                        </div>
                    </div>
                )}
            </Show>
        </div>
    );
}
