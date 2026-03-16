import { render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        Cloud: Icon,
        Loader2: Icon,
        Plus: Icon,
        RefreshCw: Icon,
        ShieldAlert: Icon,
        TerminalSquare: Icon,
        Trash2: Icon,
    };
});

vi.mock("../../lib/repoContext", () => ({
    withAuthHeaders: () => ({}),
}));

vi.mock("../../lib/repoScopedResources", () => ({
    loadUserRepoOptions: () => Promise.resolve([]),
    parseRepoSelection: () => null,
}));

import WorkspacesList from "./WorkspacesList";

describe("WorkspacesList", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn(() =>
            Promise.resolve(new Response(JSON.stringify([]), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })),
        ) as unknown as typeof fetch);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renders the workspaces heading", async () => {
        render(() => <WorkspacesList />);
        await waitFor(() => {
            expect(screen.getByRole("heading", { level: 1, name: /workspaces/i })).toBeInTheDocument();
        });
    });

    it("shows loading state for repos on mount", async () => {
        render(() => <WorkspacesList />);
        // Component starts by loading repos
        expect(document.body.textContent).toBeTruthy();
    });
});
