import { render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { navigateMock } = vi.hoisted(() => ({
    navigateMock: vi.fn(),
}));

vi.mock("@solidjs/router", () => ({
    useNavigate: () => navigateMock,
    useSearchParams: () => [
        { deleted: null },
        vi.fn(),
    ],
}));

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        Book: Icon,
        Plus: Icon,
        Lock: Icon,
        Globe: Icon,
        Search: Icon,
        CheckCircle2: Icon,
        X: Icon,
    };
});

vi.mock("../../lib/keyboard", () => ({
    useListNavigation: () => ({
        selectedIndex: () => 0,
        setSelectedIndex: vi.fn(),
        setItemRef: vi.fn(),
        selectedItemIds: () => [],
        clearSelection: vi.fn(),
        isSelected: () => false,
    }),
    useSearchFocusTarget: vi.fn(),
}));

vi.mock("../keyboard/ShortcutBadge", () => ({
    default: () => null,
}));

vi.mock("../../layouts/AppLayout", () => ({
    useAuth: () => ({
        user: () => ({ id: 1, username: "alice", display_name: "Alice" }),
        isLoading: () => false,
    }),
}));

import ReposList from "./ReposList";

describe("ReposList", () => {
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

    it("renders the repos list heading", async () => {
        render(() => <ReposList />);
        await waitFor(() => {
            expect(screen.getByText("Repositories")).toBeInTheDocument();
        });
    });

    it("shows empty state when no repos are returned", async () => {
        render(() => <ReposList />);
        await waitFor(() => {
            expect(screen.getByText(/don't have any repositories/i)).toBeInTheDocument();
        });
    });
});
