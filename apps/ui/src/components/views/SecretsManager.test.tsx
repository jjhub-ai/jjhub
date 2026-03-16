import { render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        EyeOff: Icon,
        KeyRound: Icon,
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

import SecretsManager from "./SecretsManager";

describe("SecretsManager", () => {
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

    it("renders the secrets manager heading", async () => {
        render(() => <SecretsManager />);
        await waitFor(() => {
            expect(screen.getByRole("heading", { name: /secrets/i })).toBeInTheDocument();
        });
    });

    it("renders without crashing", async () => {
        render(() => <SecretsManager />);
        expect(document.body.textContent).toBeTruthy();
    });
});
