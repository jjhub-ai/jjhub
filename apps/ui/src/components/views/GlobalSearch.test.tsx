import { render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@solidjs/router", () => ({
    useSearchParams: () => [{ q: "", tab: "" }, vi.fn()],
}));

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        Search: Icon,
        Book: Icon,
        CircleDot: Icon,
        Code2: Icon,
        Users: Icon,
        Globe: Icon,
        Lock: Icon,
        CheckCircle2: Icon,
        FileCode: Icon,
        ChevronLeft: Icon,
        ChevronRight: Icon,
        AlertCircle: Icon,
    };
});

vi.mock("../../lib/repoContext", () => ({
    apiFetch: vi.fn(() => Promise.resolve(new Response("{}", { status: 200 }))),
}));

vi.mock("../../lib/keyboard", () => ({
    useSearchFocusTarget: vi.fn(),
}));

vi.mock("../PrefetchLink", () => ({
    default: (props: Record<string, unknown>) => props.children,
}));

vi.mock("../../lib/navigationData", () => ({
    issueDetailResource: { peek: () => undefined, key: () => "issue-detail" },
    repoContentsResource: { peek: () => undefined, key: () => "repo-contents" },
    repoFileResource: { peek: () => undefined, key: () => "repo-file" },
}));

import GlobalSearch from "./GlobalSearch";

describe("GlobalSearch", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn(() =>
            Promise.resolve(new Response(JSON.stringify({ items: [], total_count: 0 }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })),
        ) as unknown as typeof fetch);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renders the search view", async () => {
        render(() => <GlobalSearch />);
        await waitFor(() => {
            expect(screen.getByText("Search JJHub")).toBeInTheDocument();
        });
    });

    it("shows repository tab", async () => {
        render(() => <GlobalSearch />);
        await waitFor(() => {
            expect(screen.getByRole("button", { name: /repositories/i })).toBeInTheDocument();
        });
    });
});
