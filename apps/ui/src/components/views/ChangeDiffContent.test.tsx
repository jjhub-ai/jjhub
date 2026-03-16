// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repoApiFetch = vi.fn();

vi.setConfig({ testTimeout: 10000 });

vi.mock("../../lib/repoContext", () => ({
    repoApiFetch,
}));

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        ChevronDown: Icon,
        ChevronRight: Icon,
        File: Icon,
        FileDiff: Icon,
        Minus: Icon,
        Plus: Icon,
    };
});

vi.mock("../editor/MonacoDiffEditor", () => ({
    default: () => null,
}));

vi.mock("../../lib/featureFlags", () => {
    const { atom } = require("nanostores");
    return {
        featureFlags: atom({ web_editor: false }),
    };
});

vi.mock("../../stores/workbench", () => {
    const { atom } = require("nanostores");
    return {
        $editorTheme: atom("system"),
    };
});

vi.mock("./DiffViewer", () => ({
    default: (props: {
        files: unknown[];
        isLoading: boolean;
        errorMessage: string | null;
    }) => (
        <div
            data-testid="diff-viewer"
            data-loading={String(props.isLoading)}
            data-error={props.errorMessage ?? ""}
        >
            {JSON.stringify(props.files)}
        </div>
    ),
}));

function installStorageMock() {
    const state = new Map<string, string>();
    const storage = {
        getItem: (key: string) => state.get(key) ?? null,
        setItem: (key: string, value: string) => {
            state.set(key, value);
        },
        removeItem: (key: string) => {
            state.delete(key);
        },
        clear: () => {
            state.clear();
        },
    };

    Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: storage,
    });

    return storage;
}

describe("ChangeDiffContent", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        installStorageMock();
        if (typeof performance.mark !== "function") {
            Object.defineProperty(performance, "mark", { configurable: true, value: vi.fn() });
        }
        if (typeof performance.measure !== "function") {
            Object.defineProperty(performance, "measure", { configurable: true, value: vi.fn() });
        }
        const mod = await import("../../stores/diff-preferences");
        mod.resetDiffPreferences();
    });

    afterEach(() => {
        cleanup();
        installStorageMock().clear();
    });

    it("loads file diffs and passes them to the shared viewer", async () => {
        repoApiFetch.mockResolvedValueOnce(new Response(JSON.stringify({
            change_id: "chg-1",
            file_diffs: [{
                path: "README.md",
                change_type: "modified",
                patch: "@@ -1 +1 @@\n-old\n+new\n",
                is_binary: false,
                language: "markdown",
                additions: 1,
                deletions: 1,
            }],
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        }));

        const { default: ChangeDiffContent } = await import("./ChangeDiffContent");

        render(() => <ChangeDiffContent changeId="chg-1" repoContext={{ owner: "alice", repo: "demo" }} />);

        expect(screen.getByTestId("diff-viewer")).toHaveAttribute("data-loading", "true");

        await waitFor(() => {
            expect(screen.getByTestId("diff-viewer")).toHaveAttribute("data-loading", "false");
        });

        expect(repoApiFetch).toHaveBeenCalledWith("/changes/chg-1/diff", {}, { owner: "alice", repo: "demo" });
        expect(screen.getByTestId("diff-viewer").textContent).toContain("README.md");
        expect(screen.getByTestId("diff-viewer").textContent).toContain("\"id\":\"chg-1:README.md\"");
    });

    it("surfaces API errors through the shared viewer", async () => {
        repoApiFetch.mockResolvedValueOnce(new Response("boom", { status: 500 }));

        const { default: ChangeDiffContent } = await import("./ChangeDiffContent");

        render(() => <ChangeDiffContent changeId="chg-2" repoContext={{ owner: "alice", repo: "demo" }} />);

        await waitFor(() => {
            expect(screen.getByTestId("diff-viewer")).toHaveAttribute("data-error", "Failed to load diff (500)");
        });
    });

    it("adds the whitespace query when the preference is ignore", async () => {
        const prefs = await import("../../stores/diff-preferences");
        prefs.setDiffWhitespaceMode("ignore");

        repoApiFetch.mockResolvedValueOnce(new Response(JSON.stringify({
            change_id: "chg-3",
            file_diffs: [],
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        }));

        const { default: ChangeDiffContent } = await import("./ChangeDiffContent");

        render(() => <ChangeDiffContent changeId="chg-3" repoContext={{ owner: "alice", repo: "demo" }} />);

        await waitFor(() => {
            expect(repoApiFetch).toHaveBeenCalledWith("/changes/chg-3/diff?whitespace=ignore", {}, { owner: "alice", repo: "demo" });
        });
    });
});
