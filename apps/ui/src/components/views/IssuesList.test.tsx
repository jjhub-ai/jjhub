import { render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { navigateMock } = vi.hoisted(() => ({
    navigateMock: vi.fn(),
}));

vi.mock("@solidjs/router", () => {
    return {
        useNavigate: () => navigateMock,
        useParams: () => ({ owner: "alice", repo: "demo" }),
    };
});

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        CheckCircle2: Icon,
        CircleDot: Icon,
        MessageSquare: Icon,
        Plus: Icon,
        Search: Icon,
        ChevronDown: Icon,
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

import IssuesList from "./IssuesList";
import { issuesListResource, type IssueSummary } from "../../lib/navigationData";
import { clearPrefetchCache, setCachedValue } from "../../lib/prefetchCache";

describe("IssuesList", () => {
    beforeEach(() => {
        navigateMock.mockReset();
        clearPrefetchCache();
        vi.stubGlobal("fetch", vi.fn(() => {
            throw new Error("fetch should not run on a cache hit");
        }) as unknown as typeof fetch);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        clearPrefetchCache();
    });

    it("renders prefetched issues immediately without showing the loading state", async () => {
        const cachedIssues: IssueSummary[] = [
            {
                id: 1,
                number: 42,
                title: "Prefetched issue",
                body: "Body",
                state: "open",
                author: { id: 1, login: "will" },
                labels: [],
                comment_count: 2,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
        ];

        setCachedValue(
            issuesListResource.key({ owner: "alice", repo: "demo" }),
            cachedIssues,
        );

        render(() => <IssuesList />);

        expect(screen.queryByText("Loading issues...")).not.toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText("Prefetched issue")).toBeInTheDocument();
        });

        expect(globalThis.fetch).not.toHaveBeenCalled();
    });
});
