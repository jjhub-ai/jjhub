import { fireEvent, render, screen, waitFor, within } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addPinnedPage, resetPinnedPages, setPinnedPagesScope, $pinnedPages } from "../stores/pinned-pages";

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return new Proxy({}, {
        get: () => Icon,
    });
});

vi.mock("@solidjs/router", () => {
    const Anchor = (props: any) => <a {...props}>{props.children}</a>;
    return { A: Anchor };
});

import Sidebar from "./Sidebar";

describe("Sidebar", () => {
    beforeEach(() => {
        resetPinnedPages();
        window.localStorage.clear();
        setPinnedPagesScope("test-user");
        vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
            const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
            if (url.includes("/api/user")) {
                return new Response(JSON.stringify({ username: "will" }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }

            if (url.includes("/api/notifications/list")) {
                return new Response(JSON.stringify([]), {
                    status: 200,
                    headers: { "X-Total-Count": "0", "Content-Type": "application/json" },
                });
            }

            return new Response("Not Found", { status: 404 });
        }) as typeof fetch);
    });

    afterEach(() => {
        resetPinnedPages();
        window.localStorage.clear();
        vi.unstubAllGlobals();
    });

    it("shows repo navigation after client-side navigation into a repo", async () => {
        let setActivePath: ((path: string) => void) | undefined;

        render(() => {
            const [activePath, setPath] = createSignal("/");
            setActivePath = setPath;
            return <Sidebar activePath={activePath()} />;
        });

        expect(screen.queryByText("Issues")).not.toBeInTheDocument();

        setActivePath?.("/alice/demo/code");

        await waitFor(() => {
            expect(screen.getByText("demo")).toBeInTheDocument();
            expect(screen.getByText("Issues")).toBeInTheDocument();
            expect(screen.getByText("Wiki")).toBeInTheDocument();
            expect(screen.getByText("Deploy Keys")).toBeInTheDocument();
        });
    });

    it("encodes repo links when owner or repo names contain special characters", async () => {
        render(() => <Sidebar activePath="/alice smith/demo repo.v1/code" />);

        await waitFor(() => {
            expect(screen.getByText("Issues")).toBeInTheDocument();
        });

        expect(screen.getByText("Issues").closest("a")).toHaveAttribute(
            "href",
            "/alice%20smith/demo%20repo.v1/issues",
        );
        expect(screen.getByTitle("Repository Settings").closest("a")).toHaveAttribute(
            "href",
            "/alice%20smith/demo%20repo.v1/settings",
        );
        expect(screen.getByText("Wiki").closest("a")).toHaveAttribute(
            "href",
            "/alice%20smith/demo%20repo.v1/wiki",
        );
        expect(screen.getByText("Deploy Keys").closest("a")).toHaveAttribute(
            "href",
            "/alice%20smith/demo%20repo.v1/keys",
        );
    });

    it("does not treat admin routes as repository paths", async () => {
        render(() => <Sidebar activePath="/admin/users" />);

        await waitFor(() => {
            expect(screen.getByText("Repositories")).toBeInTheDocument();
        });

        expect(screen.queryByText("Issues")).not.toBeInTheDocument();
    });

    it("renders pinned pages above the main navigation and lets users unpin them", async () => {
        addPinnedPage({ url: "/inbox" });
        addPinnedPage({ url: "/workspaces" });

        render(() => <Sidebar activePath="/inbox" />);

        const pinnedGroup = screen.getByText("Pinned").closest(".pinned-group") as HTMLElement | null;
        expect(pinnedGroup).toBeTruthy();
        expect(within(pinnedGroup!).getByRole("link", { name: "Inbox" })).toBeInTheDocument();
        expect(within(pinnedGroup!).getByRole("link", { name: "Workspaces" })).toBeInTheDocument();

        await fireEvent.click(screen.getByRole("button", { name: "Unpin Inbox" }));
        expect($pinnedPages.get().map((page) => page.url)).toEqual(["/workspaces"]);
    });

    it("reorders pinned pages with drag and drop", async () => {
        addPinnedPage({ url: "/inbox" });
        addPinnedPage({ url: "/workspaces" });
        addPinnedPage({ url: "/settings" });

        render(() => <Sidebar activePath="/inbox" />);

        const pinnedGroup = screen.getByText("Pinned").closest(".pinned-group") as HTMLElement | null;
        expect(pinnedGroup).toBeTruthy();

        const settingsPin = within(pinnedGroup!).getByRole("link", { name: "Settings" }).closest(".pinned-item-row") as HTMLElement | null;
        const inboxPin = within(pinnedGroup!).getByRole("link", { name: "Inbox" }).closest(".pinned-item-row") as HTMLElement | null;

        expect(settingsPin).toBeTruthy();
        expect(inboxPin).toBeTruthy();

        await fireEvent.dragStart(settingsPin!);
        await fireEvent.dragOver(inboxPin!);
        await fireEvent.drop(inboxPin!);

        expect($pinnedPages.get().map((page) => page.url)).toEqual([
            "/settings",
            "/inbox",
            "/workspaces",
        ]);
    });
});
