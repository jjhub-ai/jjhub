import { render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@solidjs/router", () => ({
    useParams: () => ({ owner: "alice", repo: "demo" }),
    A: (props: Record<string, unknown>) => props.children,
}));

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        Book: Icon,
        Star: Icon,
        Eye: Icon,
        GitFork: Icon,
        Copy: Icon,
        Check: Icon,
        FileText: Icon,
        Folder: Icon,
        Github: Icon,
        Terminal: Icon,
        Info: Icon,
        Activity: Icon,
        Clock: Icon,
        Shield: Icon,
        Globe: Icon,
        Lock: Icon,
    };
});

vi.mock("markdown-it", () => ({
    default: class {
        render(src: string) {
            return `<p>${src}</p>`;
        }
    },
}));

vi.mock("../../lib/repoContext", () => ({
    apiFetch: vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({
            id: 1,
            owner: "alice",
            name: "demo",
            full_name: "alice/demo",
            description: "A demo repo",
            is_public: true,
            is_archived: false,
            num_stars: 5,
            num_watchers: 2,
            num_forks: 1,
            default_branch: "main",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        })),
    ),
    repoApiFetch: vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        })),
    ),
}));

import RepoOverview from "./RepoOverview";

describe("RepoOverview", () => {
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

    it("renders the repo overview", async () => {
        render(() => <RepoOverview />);
        await waitFor(() => {
            expect(document.body.textContent).toBeTruthy();
        });
    });
});
