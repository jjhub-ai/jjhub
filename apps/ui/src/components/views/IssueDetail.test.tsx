import { render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@solidjs/router", () => ({
    useParams: () => ({ owner: "alice", repo: "demo", id: "42" }),
}));

vi.mock("@nanostores/solid", () => ({
    useStore: () => () => false,
}));

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        CheckCircle2: Icon,
        CircleDot: Icon,
        Edit3: Icon,
        MessageSquare: Icon,
        X: Icon,
    };
});

vi.mock("../../stores/workbench", () => ({
    isCommandPaletteOpen: { get: () => false },
    isKeyboardHelpOpen: { get: () => false },
    toggleAgentDock: vi.fn(),
}));

vi.mock("../PrefetchLink", () => ({
    default: (props: Record<string, unknown>) => props.children,
}));

vi.mock("../../lib/repoContext", () => ({
    apiFetch: vi.fn(() => Promise.resolve(new Response("{}", { status: 200 }))),
    repoApiFetch: vi.fn(() => Promise.resolve(new Response("{}", { status: 200 }))),
}));

vi.mock("../../lib/keyboard", () => ({
    useKeyboardActionTarget: vi.fn(),
    useSingleKeyShortcuts: vi.fn(),
}));

vi.mock("../keyboard/ShortcutBadge", () => ({
    default: () => null,
}));

vi.mock("../../lib/navigationData", () => ({
    issueDetailResource: {
        peek: () => undefined,
        key: () => "issue-detail",
        load: () => Promise.resolve(null),
    },
    issuesListResource: {
        peek: () => undefined,
        key: () => "issues-list",
    },
}));

vi.mock("../../lib/prefetchCache", () => ({
    setCachedValue: vi.fn(),
    clearPrefetchCache: vi.fn(),
}));

import IssueDetail from "./IssueDetail";

describe("IssueDetail", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn(() =>
            Promise.resolve(new Response(JSON.stringify({
                id: 42,
                number: 42,
                title: "Test issue",
                body: "Issue body",
                state: "open",
                author: { id: 1, login: "alice" },
                labels: [],
                assignees: [],
                comments: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })),
        ) as unknown as typeof fetch);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renders without crashing", async () => {
        render(() => <IssueDetail />);
        await waitFor(() => {
            expect(document.querySelector(".issue-detail, [class*='issue']") || document.body.textContent).toBeTruthy();
        });
    });
});
