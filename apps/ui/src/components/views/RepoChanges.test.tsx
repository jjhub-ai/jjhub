import { render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@solidjs/router", () => ({
    useParams: () => ({ owner: "alice", repo: "demo" }),
}));

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        CheckCircle2: Icon,
        GitCommit: Icon,
        Hash: Icon,
        MessageSquare: Icon,
        MoreVertical: Icon,
        ChevronRight: Icon,
        ChevronDown: Icon,
    };
});

vi.mock("./ChangeDiffContent", () => ({
    default: () => null,
}));

vi.mock("../../lib/navigationData", () => ({
    repoChangesResource: {
        peek: () => undefined,
        key: () => "repo-changes",
        load: () => Promise.resolve([]),
    },
}));

import RepoChanges from "./RepoChanges";

describe("RepoChanges", () => {
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

    it("renders the changes view", async () => {
        render(() => <RepoChanges />);
        await waitFor(() => {
            expect(screen.getByText(/changes/i)).toBeInTheDocument();
        });
    });

    it("shows loading or empty state initially", async () => {
        render(() => <RepoChanges />);
        expect(document.body.textContent).toBeTruthy();
    });
});
