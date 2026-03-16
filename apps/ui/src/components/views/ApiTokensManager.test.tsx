import { render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        KeyRound: Icon,
        Plus: Icon,
        Trash2: Icon,
        Clock: Icon,
        CheckCircle2: Icon,
        Shield: Icon,
        Copy: Icon,
        AlertTriangle: Icon,
    };
});

vi.mock("../../lib/repoContext", () => ({
    withAuthHeaders: () => ({}),
}));

import ApiTokensManager from "./ApiTokensManager";

describe("ApiTokensManager", () => {
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

    it("renders the API tokens heading", async () => {
        render(() => <ApiTokensManager />);
        await waitFor(() => {
            expect(screen.getByText(/api tokens/i)).toBeInTheDocument();
        });
    });

    it("shows empty state when no tokens exist", async () => {
        render(() => <ApiTokensManager />);
        await waitFor(() => {
            expect(screen.getByText(/no.*token/i)).toBeInTheDocument();
        });
    });
});
