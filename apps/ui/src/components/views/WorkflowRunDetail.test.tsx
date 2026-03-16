// @vitest-environment jsdom

import { render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const listeners = new Map<string, Set<(event: MessageEvent) => void>>();
    const navigateMock = vi.fn();
    const repoApiFetchMock = vi.fn();
    const eventSource = {
        addEventListener: vi.fn((type: string, listener: (event: MessageEvent) => void) => {
            const bucket = listeners.get(type) ?? new Set();
            bucket.add(listener);
            listeners.set(type, bucket);
        }),
        removeEventListener: vi.fn((type: string, listener: (event: MessageEvent) => void) => {
            listeners.get(type)?.delete(listener);
        }),
        close: vi.fn(),
        onerror: null as ((error: unknown) => void) | null,
    };

    return {
        navigateMock,
        repoApiFetchMock,
        createAuthenticatedEventSourceMock: vi.fn(() => eventSource),
        reset() {
            listeners.clear();
            navigateMock.mockReset();
            repoApiFetchMock.mockReset();
            eventSource.addEventListener.mockClear();
            eventSource.removeEventListener.mockClear();
            eventSource.close.mockClear();
            eventSource.onerror = null;
            this.createAuthenticatedEventSourceMock.mockClear();
        },
        emit(type: string, payload: unknown) {
            const event = new MessageEvent(type, {
                data: typeof payload === "string" ? payload : JSON.stringify(payload),
            });
            for (const listener of listeners.get(type) ?? []) {
                listener(event);
            }
        },
    };
});

vi.mock("@solidjs/router", () => ({
    useNavigate: () => mocks.navigateMock,
    useParams: () => ({ owner: "alice", repo: "demo", id: "42" }),
}));

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        ArrowLeft: Icon,
        CheckCircle2: Icon,
        ChevronDown: Icon,
        ChevronRight: Icon,
        Clock: Icon,
        GitCommit: Icon,
        Loader2: Icon,
        Play: Icon,
        RefreshCw: Icon,
        Square: Icon,
        Timer: Icon,
        XCircle: Icon,
    };
});

vi.mock("../../lib/repoContext", () => ({
    repoApiFetch: (...args: unknown[]) => mocks.repoApiFetchMock(...args),
    repoApiPath: (suffix: string, context: { owner: string; repo: string }) => `/api/repos/${context.owner}/${context.repo}${suffix}`,
}));

vi.mock("../../lib/authenticatedEventSource", () => ({
    createAuthenticatedEventSource: (url: string, init?: { withCredentials?: boolean }) =>
        mocks.createAuthenticatedEventSourceMock(url, init),
}));

import WorkflowRunDetail from "./WorkflowRunDetail";

const runningRun = {
    id: 42,
    repository_id: 10,
    workflow_definition_id: 7,
    status: "running",
    trigger_event: "dispatch",
    trigger_ref: "main",
    trigger_commit_sha: "abc1234def5678",
    started_at: "2026-03-14T18:00:00Z",
    completed_at: null,
    created_at: "2026-03-14T18:00:00Z",
    updated_at: "2026-03-14T18:00:00Z",
};

const runningSteps = [
    {
        id: 101,
        workflow_run_id: 42,
        name: "build",
        position: 1,
        status: "running",
        started_at: "2026-03-14T18:00:01Z",
        completed_at: null,
        created_at: "2026-03-14T18:00:00Z",
        updated_at: "2026-03-14T18:00:01Z",
    },
];

describe("WorkflowRunDetail", () => {
    beforeEach(() => {
        mocks.reset();
        mocks.repoApiFetchMock.mockImplementation(async (path: string) => {
            if (path === "/actions/runs/42") {
                return new Response(JSON.stringify(runningRun), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }
            if (path === "/actions/runs/42/steps") {
                return new Response(JSON.stringify({ steps: runningSteps }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }
            if (path === "/workflows/7") {
                return new Response(JSON.stringify({
                    id: 7,
                    name: "CI",
                    path: ".jjhub/workflows/ci.tsx",
                    is_active: true,
                }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }
            return new Response("not found", { status: 404 });
        });
    });

    it("connects to the repo-scoped workflow log SSE stream", async () => {
        render(() => <WorkflowRunDetail />);

        await waitFor(() => {
            expect(mocks.createAuthenticatedEventSourceMock).toHaveBeenCalledWith(
                "/api/repos/alice/demo/runs/42/logs",
                { withCredentials: true },
            );
        });
    });

    it("renders normalized live log lines from the SSE stream", async () => {
        render(() => <WorkflowRunDetail />);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: "Pause auto-scroll" })).toBeInTheDocument();
        });

        mocks.emit("status", {
            run: runningRun,
            steps: runningSteps,
        });
        mocks.emit("log", {
            log_id: 9,
            step: 101,
            line: 1,
            content: "Compiling workflow",
            stream: "stdout",
        });

        await waitFor(() => {
            expect(screen.getByText("Compiling workflow")).toBeInTheDocument();
            expect(screen.getByText("1")).toBeInTheDocument();
        });
    });
});
