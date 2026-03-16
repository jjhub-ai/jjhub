import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearPrefetchCache } from "../../lib/prefetchCache";

const { navigateMock } = vi.hoisted(() => ({
    navigateMock: vi.fn(),
}));

let fetchMock: ReturnType<typeof vi.fn>;

vi.mock("@solidjs/router", () => {
    return {
        useNavigate: () => navigateMock,
        useParams: () => ({ owner: "alice", repo: "demo" }),
    };
});

vi.mock("lucide-solid", () => {
    const Icon = () => null;

    return {
        BookMarked: Icon,
        FileCode: Icon,
        GitCommit: Icon,
        GitPullRequest: Icon,
        Search: Icon,
    };
});

import RepoBookmarks from "./RepoBookmarks";

describe("RepoBookmarks", () => {
    beforeEach(() => {
        navigateMock.mockReset();
        clearPrefetchCache();
        const localStorageMock = {
            getItem: vi.fn(() => null),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
            key: vi.fn(),
            length: 0,
        };

        vi.stubGlobal("localStorage", localStorageMock);
        Object.defineProperty(window, "localStorage", {
            configurable: true,
            value: localStorageMock,
        });

        fetchMock = vi.fn(async (input: RequestInfo | URL) => {
                const requestUrl =
                    typeof input === "string"
                        ? input
                        : input instanceof URL
                          ? input.toString()
                          : input.url;
                const url = new URL(requestUrl, window.location.origin);

                if (url.pathname === "/api/repos/alice/demo" && !url.search) {
                    return new Response(
                        JSON.stringify({ default_bookmark: "local-only" }),
                        {
                            status: 200,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                if (url.pathname === "/api/repos/alice/demo/bookmarks") {
                    return new Response(
                        JSON.stringify([
                            {
                                name: "local-only",
                                target_change_id: "abc123",
                                target_commit_id: "1111111",
                                is_tracking_remote: false,
                            },
                            {
                                name: "remote-tracked",
                                target_change_id: "def456",
                                target_commit_id: "2222222",
                                is_tracking_remote: true,
                                remote_name: "origin/remote-tracked",
                            },
                        ]),
                        {
                            status: 200,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                return new Response("Not Found", { status: 404 });
            });
        vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        clearPrefetchCache();
    });

    it("filters bookmark rows when Active, Remote, and All tabs are selected", async () => {
        render(() => <RepoBookmarks />);

        await waitFor(() => {
            expect(screen.getByText("local-only")).toBeInTheDocument();
        });

        const activeTab = screen.getByRole("button", { name: "Active" });
        const remoteTab = screen.getByRole("button", { name: "Remote" });
        const allTab = screen.getByRole("button", { name: "All" });

        expect(activeTab).toHaveClass("active");
        expect(remoteTab).not.toHaveClass("active");
        expect(allTab).not.toHaveClass("active");
        expect(screen.queryByText("remote-tracked")).not.toBeInTheDocument();

        await fireEvent.click(remoteTab);

        await waitFor(() => {
            expect(screen.getByText("remote-tracked")).toBeInTheDocument();
        });
        expect(screen.queryByText("local-only")).not.toBeInTheDocument();
        expect(remoteTab).toHaveClass("active");
        expect(activeTab).not.toHaveClass("active");

        await fireEvent.click(allTab);

        await waitFor(() => {
            expect(screen.getByText("local-only")).toBeInTheDocument();
            expect(screen.getByText("remote-tracked")).toBeInTheDocument();
        });
        expect(allTab).toHaveClass("active");
        expect(remoteTab).not.toHaveClass("active");
    });

    it("navigates to the code browser from the View Code action and removes checkout", async () => {
        render(() => <RepoBookmarks />);

        await waitFor(() => {
            expect(screen.getByText("local-only")).toBeInTheDocument();
        });

        await fireEvent.click(screen.getByRole("button", { name: "View Code" }));

        expect(navigateMock).toHaveBeenCalledWith("/alice/demo/code?ref=local-only");
        expect(screen.queryByRole("button", { name: "Checkout User Workspace" })).toBeNull();
    });

    it("loads bookmarks using route params instead of an empty repo context", async () => {
        render(() => <RepoBookmarks />);

        await waitFor(() => {
            expect(screen.getByText("local-only")).toBeInTheDocument();
        });

        const requestedUrls = (fetchMock.mock.calls as Array<[RequestInfo | URL | Request]>).map(([input]) => {
            return typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.toString()
                  : input.url;
        });

        expect(requestedUrls).toContain("/api/repos/alice/demo");
        expect(requestedUrls).toContain("/api/repos/alice/demo/bookmarks?per_page=100");
        expect(requestedUrls).not.toContain("/api/repos/bookmarks");
    });
});
