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
        CheckCircle2: Icon,
        ChevronDown: Icon,
        FileDiff: Icon,
        GitMerge: Icon,
        GitPullRequestDraft: Icon,
        MessageSquare: Icon,
        Plus: Icon,
        Search: Icon,
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

vi.mock("../../lib/prefetchCache", () => ({
    createHoverPrefetchHandlers: () => ({}),
    clearPrefetchCache: vi.fn(),
    setCachedValue: vi.fn(),
}));

vi.mock("../../lib/navigationData", () => ({
    landingDiffResource: { peek: () => undefined, key: () => "landing-diff" },
    landingDetailResource: { peek: () => undefined, key: () => "landing-detail" },
    landingsListResource: { peek: () => undefined, key: () => "landings-list", load: () => Promise.resolve([]) },
}));

import LandingsList from "./LandingsList";

describe("LandingsList", () => {
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

    it("renders the landing requests heading", async () => {
        render(() => <LandingsList />);
        await waitFor(() => {
            expect(screen.getByText("Landing Requests")).toBeInTheDocument();
        });
    });

    it("shows loading state initially when no cache exists", async () => {
        render(() => <LandingsList />);
        await waitFor(() => {
            expect(screen.getByText(/loading/i)).toBeInTheDocument();
        });
    });
});
