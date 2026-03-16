import { render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { navigateMock } = vi.hoisted(() => ({
    navigateMock: vi.fn(),
}));

vi.mock("@solidjs/router", () => ({
    useNavigate: () => navigateMock,
    useParams: () => ({ owner: "alice", repo: "demo" }),
}));

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        Settings: Icon,
        Tag: Icon,
        Target: Icon,
        Webhook: Icon,
        Plus: Icon,
        Trash2: Icon,
        Edit2: Icon,
        CheckCircle2: Icon,
        AlertTriangle: Icon,
        Send: Icon,
    };
});

vi.mock("../../lib/repoContext", () => ({
    withAuthHeaders: (extra?: Record<string, string>) => ({ ...extra }),
}));

import RepoSettings from "./RepoSettings";

describe("RepoSettings", () => {
    beforeEach(() => {
        navigateMock.mockReset();
        vi.stubGlobal("fetch", vi.fn(() =>
            Promise.resolve(new Response(JSON.stringify({
                name: "demo",
                description: "A demo repo",
                is_public: true,
                default_bookmark: "main",
                topics: [],
            }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })),
        ) as unknown as typeof fetch);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renders the settings page with tabs", async () => {
        render(() => <RepoSettings />);
        await waitFor(() => {
            expect(screen.getByText(/general/i)).toBeInTheDocument();
        });
    });

    it("shows labels tab option", async () => {
        render(() => <RepoSettings />);
        await waitFor(() => {
            expect(screen.getByText(/labels/i)).toBeInTheDocument();
        });
    });
});
