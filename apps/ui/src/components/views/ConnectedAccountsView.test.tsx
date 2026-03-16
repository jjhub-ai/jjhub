import { render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        Link2: Icon,
        Trash2: Icon,
    };
});

vi.mock("../../lib/repoContext", () => ({
    withAuthHeaders: () => ({}),
}));

vi.mock("./viewSupport", () => ({
    formatDateTime: (s: string) => s,
    readErrorMessage: () => "error",
}));

import ConnectedAccountsView from "./ConnectedAccountsView";

describe("ConnectedAccountsView", () => {
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

    it("renders the connected accounts heading", async () => {
        render(() => <ConnectedAccountsView />);
        await waitFor(() => {
            expect(screen.getByText("Connected Accounts")).toBeInTheDocument();
        });
    });

    it("shows empty state when no accounts are linked", async () => {
        render(() => <ConnectedAccountsView />);
        await waitFor(() => {
            expect(screen.getByText(/no connected accounts/i)).toBeInTheDocument();
        });
    });
});
