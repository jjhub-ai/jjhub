import { fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { $pinnedPages, resetPinnedPages, setPinnedPagesScope } from "../../stores/pinned-pages";

let mockedPathname = "/inbox";
let mockedSearch = "";

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return new Proxy({}, {
        get: () => Icon,
    });
});

vi.mock("@solidjs/router", () => ({
    useLocation: () => ({
        pathname: mockedPathname,
        search: mockedSearch,
    }),
}));

import GlobalStrip from "./GlobalStrip";

describe("GlobalStrip", () => {
    beforeEach(() => {
        resetPinnedPages();
        window.localStorage.clear();
        setPinnedPagesScope("test-user");
        mockedPathname = "/inbox";
        mockedSearch = "";
        vi.useFakeTimers();
        vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })) as typeof fetch);
    });

    afterEach(() => {
        resetPinnedPages();
        window.localStorage.clear();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("pins and unpins the current page from the strip button", async () => {
        render(() => <GlobalStrip />);

        const button = screen.getByRole("button", { name: /Pin this page/i });
        await fireEvent.click(button);

        expect($pinnedPages.get().map((page) => page.url)).toEqual(["/inbox"]);

        await fireEvent.click(screen.getByRole("button", { name: /Unpin this page/i }));
        expect($pinnedPages.get()).toEqual([]);
    });

    it("toggles the current page with Alt+P", async () => {
        mockedPathname = "/alice/demo/code";
        mockedSearch = "?path=src%2Fapp.ts&ref=feature";

        render(() => <GlobalStrip />);

        await fireEvent.keyDown(window, { altKey: true, key: "p", code: "KeyP" });
        expect($pinnedPages.get()).toEqual([
            {
                icon: "FileText",
                order: 0,
                title: "alice/demo · src/app.ts @ feature",
                url: "/alice/demo/code?path=src%2Fapp.ts&ref=feature",
            },
        ]);

        await fireEvent.keyDown(window, { altKey: true, key: "p", code: "KeyP" });
        expect($pinnedPages.get()).toEqual([]);
    });

    it("keeps pinning disabled until the storage scope is resolved", async () => {
        resetPinnedPages();

        render(() => <GlobalStrip />);

        const button = screen.getByRole("button", { name: /Pinned pages are loading/i });
        expect(button).toBeDisabled();

        await fireEvent.click(button);
        await fireEvent.keyDown(window, { altKey: true, key: "p", code: "KeyP" });

        expect($pinnedPages.get()).toEqual([]);
    });
});
