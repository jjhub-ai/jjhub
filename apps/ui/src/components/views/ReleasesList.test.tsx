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
        Boxes: Icon,
        Clock3: Icon,
        PackagePlus: Icon,
    };
});

vi.mock("../../lib/authenticatedEventSource", () => ({
    createAuthenticatedEventSource: vi.fn(() => ({
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        onerror: null,
    })),
}));

vi.mock("../../lib/repoContext", () => ({
    repoApiFetch: vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        })),
    ),
    repoApiPath: (path: string) => `/api/repos/alice/demo${path}`,
}));

import ReleasesList from "./ReleasesList";

describe("ReleasesList", () => {
    beforeEach(() => {
        navigateMock.mockReset();
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

    it("renders the releases heading", async () => {
        render(() => <ReleasesList />);
        await waitFor(() => {
            expect(screen.getByRole("heading", { level: 1, name: /releases/i })).toBeInTheDocument();
        });
    });

    it("shows empty state when no releases exist", async () => {
        render(() => <ReleasesList />);
        await waitFor(() => {
            expect(screen.getByText(/no releases yet/i)).toBeInTheDocument();
        });
    });
});
