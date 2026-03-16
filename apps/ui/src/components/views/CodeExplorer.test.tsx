// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, createSignal } from "solid-js";
import { resetEditorState } from "../../lib/editorState";
import { featureFlags } from "../../lib/featureFlags";
import { clearPrefetchCache } from "../../lib/prefetchCache";

// Reactive router mock — signals allow tests to update searchParams after render
// and have the component's createEffect re-fire.
const routerState = vi.hoisted(() => {
    let params = { owner: "alice", repo: "demo" };
    let searchParams: Record<string, string | undefined> = {};
    let notifySearchParams: (() => void) | null = null;

    return {
        get params() {
            return params;
        },
        get searchParams() {
            return searchParams;
        },
        /** Register the SolidJS trigger so setRoute can notify the reactive graph. */
        _setNotify(fn: (() => void) | null) {
            notifySearchParams = fn;
        },
        setRoute(next: { params?: typeof params; searchParams?: Record<string, string | undefined> }) {
            if (next.params) {
                params = next.params;
            }
            searchParams = next.searchParams ?? {};
            notifySearchParams?.();
        },
    };
});

const setSearchParamsMock = vi.hoisted(() => vi.fn());

vi.mock("@solidjs/router", () => ({
    useParams: () => routerState.params,
    useSearchParams: () => {
        // Use a SolidJS signal as a version counter to trigger reactivity
        const [version, setVersion] = createSignal(0);
        routerState._setNotify(() => setVersion((v) => v + 1));

        // Return a proxy that reads the version signal on every property access,
        // making SolidJS track it as a dependency.
        const proxy = new Proxy({} as Record<string, string | undefined>, {
            get(_target, prop: string) {
                version(); // subscribe to changes
                return routerState.searchParams[prop];
            },
            has(_target, prop: string) {
                version();
                return prop in routerState.searchParams;
            },
            ownKeys() {
                version();
                return Object.keys(routerState.searchParams);
            },
            getOwnPropertyDescriptor(_target, prop: string) {
                version();
                if (prop in routerState.searchParams) {
                    return { configurable: true, enumerable: true, value: routerState.searchParams[prop] };
                }
                return undefined;
            },
        });
        return [proxy, setSearchParamsMock];
    },
}));

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        ChevronRight: Icon,
        File: Icon,
        FileCode: Icon,
        FileImage: Icon,
        FileJson: Icon,
        FileText: Icon,
        Folder: Icon,
        PencilLine: Icon,
        Search: Icon,
        X: Icon,
    };
});

vi.mock("../editor/EditorTabs", () => ({
    default: (props: { tabs: Array<{ id: string; title: string }>; onSelect: (tabId: string) => void }) => (
        <div data-testid="editor-tabs">
            {props.tabs.map((tab) => (
                <button type="button" onClick={() => props.onSelect(tab.id)}>
                    {tab.title}
                </button>
            ))}
        </div>
    ),
}));

vi.mock("../editor/FilePreview", () => ({
    default: (props: { path: string; content: string }) => (
        <div data-testid="file-preview">
            <span>{props.path}</span>
            <span>{props.content}</span>
        </div>
    ),
    detectLanguageForPath: (path: string) => (path.endsWith(".ts") ? "typescript" : "plaintext"),
    detectPreviewKind: (path: string) => (path.endsWith(".md") ? "markdown" : "code"),
}));

import CodeExplorer from "./CodeExplorer";

describe("CodeExplorer", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        clearPrefetchCache();
        resetEditorState();
        featureFlags.set({
            readout_dashboard: false,
            landing_queue: false,
            tool_skills: false,
            tool_policies: false,
            repo_snapshots: false,
            integrations: false,
            session_replay: false,
            secrets_manager: false,
            web_editor: false,
            client_error_reporting: true,
            client_metrics: true,
        });

        setSearchParamsMock.mockReset();
        routerState.setRoute({
            params: { owner: "alice", repo: "demo" },
            searchParams: {},
        });

        const localStorageMock = {
            getItem: vi.fn(() => null),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
            key: vi.fn(),
            length: 0,
        };

        vi.stubGlobal("localStorage", localStorageMock);
        Object.defineProperty(window, "localStorage", {
            configurable: true,
            value: localStorageMock,
        });

        fetchMock = vi.fn(async (input: string | URL | Request) => {
            const requestUrl =
                typeof input === "string"
                    ? input
                    : input instanceof URL
                      ? input.toString()
                      : input.url;
            const url = new URL(requestUrl, window.location.origin);

            if (url.pathname === "/api/repos/alice/demo/contents" && url.searchParams.get("ref") === "feature") {
                return new Response(
                    JSON.stringify([
                        { name: "src", path: "src", type: "dir", size: 0 },
                    ]),
                    {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            if (url.pathname === "/api/repos/alice/demo/contents/src" && url.searchParams.get("ref") === "feature") {
                return new Response(
                    JSON.stringify([
                        { name: "app.ts", path: "src/app.ts", type: "file", size: 12 },
                    ]),
                    {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            if (url.pathname === "/api/repos/alice/demo/contents/src/app.ts" && url.searchParams.get("ref") === "feature") {
                return new Response(
                    JSON.stringify({
                        name: "app.ts",
                        path: "src/app.ts",
                        type: "file",
                        encoding: "base64",
                        content: "ZXhwb3J0IHt9",
                        size: 9,
                    }),
                    {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            if (url.pathname === "/api/repos/alice/demo/contents/src" && !url.search) {
                return new Response(
                    JSON.stringify([
                        { name: "app.ts", path: "src/app.ts", type: "file", size: 12 },
                    ]),
                    {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            if (url.pathname === "/api/repos/alice/demo/contents/src/app.ts" && !url.search) {
                return new Response(
                    JSON.stringify({
                        name: "app.ts",
                        path: "src/app.ts",
                        type: "file",
                        encoding: "base64",
                        content: "ZXhwb3J0IHt9",
                        size: 9,
                    }),
                    {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            if (url.pathname === "/api/repos/alice/demo/contents" && !url.search) {
                return new Response(JSON.stringify([]), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }

            return new Response("Not Found", { status: 404 });
        });
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        resetEditorState();
        vi.unstubAllGlobals();
        clearPrefetchCache();
    });

    it("keeps the selected ref on initial and subsequent directory fetches", async () => {
        routerState.setRoute({
            params: { owner: "alice", repo: "demo" },
            searchParams: { ref: "feature" },
        });

        render(() => <CodeExplorer />);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: "src" })).toBeInTheDocument();
        });

        await fireEvent.click(screen.getByRole("button", { name: "src" }));

        await waitFor(() => {
            expect(screen.getByRole("button", { name: "app.ts" })).toBeInTheDocument();
        });

        const requestedUrls = fetchMock.mock.calls.map(([input]) => {
            return typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.toString()
                  : input.url;
        });

        expect(requestedUrls).toContain("/api/repos/alice/demo/contents?ref=feature");
        expect(requestedUrls).toContain("/api/repos/alice/demo/contents/src?ref=feature");
        expect(requestedUrls).not.toContain("/api/repos/alice/demo/contents/src");
        expect(setSearchParamsMock).toHaveBeenCalledWith(
            { ref: "feature", path: "src" },
            { replace: true },
        );
    });

    it("opens the deep-linked file path instead of defaulting to repo root", async () => {
        routerState.setRoute({
            params: { owner: "alice", repo: "demo" },
            searchParams: { ref: "feature", path: "src/app.ts" },
        });

        render(() => <CodeExplorer />);

        await waitFor(() => {
            expect(screen.getByTestId("file-preview")).toHaveTextContent("src/app.ts");
        });

        const requestedUrls = fetchMock.mock.calls.map(([input]) => {
            return typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.toString()
                  : input.url;
        });

        expect(requestedUrls).toContain("/api/repos/alice/demo/contents/src?ref=feature");
        expect(requestedUrls).toContain("/api/repos/alice/demo/contents/src/app.ts?ref=feature");
        expect(requestedUrls).not.toContain("/api/repos/alice/demo/contents");
        expect(screen.getByTestId("file-preview")).toHaveTextContent("export {}");
    });

    it("opens a new deep-link path after the explorer already loaded the repo root", async () => {
        // Start at the repo root (no path, no ref)
        routerState.setRoute({
            params: { owner: "alice", repo: "demo" },
            searchParams: {},
        });

        render(() => <CodeExplorer />);

        // Wait for the initial root directory load to fully settle
        // (the empty repo root returns [] so "No files match" appears once loading finishes)
        await waitFor(() => {
            expect(screen.getByText("No files match this filter.")).toBeInTheDocument();
        });

        // Simulate a client-side navigation to a deep-link path in the same repo
        // (e.g. clicking a code search result from GlobalSearch)
        routerState.setRoute({
            params: { owner: "alice", repo: "demo" },
            searchParams: { path: "src/app.ts" },
        });

        await waitFor(() => {
            expect(screen.getByTestId("file-preview")).toHaveTextContent("src/app.ts");
        });

        expect(screen.getByTestId("file-preview")).toHaveTextContent("export {}");
    });

    it("switches to a new ref when searchParams change within the same repo", async () => {
        // Start at the repo root with no ref
        routerState.setRoute({
            params: { owner: "alice", repo: "demo" },
            searchParams: {},
        });

        render(() => <CodeExplorer />);

        // Wait for the initial root directory load to fully settle
        await waitFor(() => {
            expect(screen.getByText("No files match this filter.")).toBeInTheDocument();
        });

        // Simulate navigating to a bookmark deep-link (e.g. from RepoBookmarks)
        routerState.setRoute({
            params: { owner: "alice", repo: "demo" },
            searchParams: { ref: "feature" },
        });

        await waitFor(() => {
            expect(screen.getByRole("button", { name: "src" })).toBeInTheDocument();
        });

        const requestedUrls = fetchMock.mock.calls.map(([input]) => {
            return typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.toString()
                  : input.url;
        });

        expect(requestedUrls).toContain("/api/repos/alice/demo/contents?ref=feature");
    });

    it("opens a path deep link without requiring a ref", async () => {
        routerState.setRoute({
            params: { owner: "alice", repo: "demo" },
            searchParams: { path: "src/app.ts" },
        });

        render(() => <CodeExplorer />);

        await waitFor(() => {
            expect(screen.getByTestId("file-preview")).toHaveTextContent("src/app.ts");
        });

        const requestedUrls = fetchMock.mock.calls.map(([input]) => {
            return typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.toString()
                  : input.url;
        });

        expect(requestedUrls).toContain("/api/repos/alice/demo/contents/src");
        expect(requestedUrls).toContain("/api/repos/alice/demo/contents/src/app.ts");
        expect(requestedUrls).not.toContain("/api/repos/alice/demo/contents?ref=feature");
        expect(screen.getByTestId("file-preview")).toHaveTextContent("export {}");
    });
});
