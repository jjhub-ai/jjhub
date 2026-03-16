import { render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        Key: Icon,
        Plus: Icon,
        Trash2: Icon,
        Clock: Icon,
        CheckCircle2: Icon,
    };
});

vi.mock("../../lib/repoContext", () => ({
    withAuthHeaders: () => ({}),
}));

import SSHKeysManager from "./SSHKeysManager";

describe("SSHKeysManager", () => {
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

    it("renders the SSH keys heading", async () => {
        render(() => <SSHKeysManager />);
        await waitFor(() => {
            expect(screen.getByRole("heading", { name: /^ssh keys$/i })).toBeInTheDocument();
        });
    });

    it("shows empty state when no keys exist", async () => {
        render(() => <SSHKeysManager />);
        await waitFor(() => {
            expect(screen.getByRole("heading", { name: /no ssh keys/i })).toBeInTheDocument();
        });
    });
});
