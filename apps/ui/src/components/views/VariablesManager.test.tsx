import { render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        Asterisk: Icon,
        Loader2: Icon,
        Plus: Icon,
        RefreshCw: Icon,
        ShieldAlert: Icon,
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

import VariablesManager from "./VariablesManager";

describe("VariablesManager", () => {
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

    it("renders the variables manager heading", async () => {
        render(() => <VariablesManager />);
        await waitFor(() => {
            expect(screen.getByRole("heading", { name: /variables/i })).toBeInTheDocument();
        });
    });

    it("renders without crashing", async () => {
        render(() => <VariablesManager />);
        expect(document.body.textContent).toBeTruthy();
    });
});
