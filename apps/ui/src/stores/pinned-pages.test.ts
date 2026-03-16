// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    $pinnedPages,
    addPinnedPage,
    hydratePinnedPages,
    movePinnedPage,
    PINNED_PAGES_LIMIT,
    removePinnedPage,
    resetPinnedPages,
    setPinnedPagesScope,
} from "./pinned-pages";

const PINNED_PAGES_STORAGE_KEY = "jjhub.sidebar.pinned-pages";

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return new Proxy({}, {
        get: () => Icon,
    });
});

function installStorageMock() {
    const state = new Map<string, string>();
    const storage = {
        getItem: (key: string) => state.get(key) ?? null,
        setItem: (key: string, value: string) => {
            state.set(key, value);
        },
        removeItem: (key: string) => {
            state.delete(key);
        },
        clear: () => {
            state.clear();
        },
    };

    Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: storage,
    });

    return storage;
}

describe("pinned pages store", () => {
    beforeEach(() => {
        installStorageMock().clear();
        resetPinnedPages();
        setPinnedPagesScope(null);
    });

    afterEach(() => {
        installStorageMock().clear();
        resetPinnedPages();
        vi.restoreAllMocks();
    });

    it("adds a pin and persists it to localStorage", () => {
        const storage = installStorageMock();

        expect(addPinnedPage({ url: "/inbox" })).toBe(true);
        expect($pinnedPages.get()).toEqual([
            {
                icon: "Inbox",
                order: 0,
                title: "Inbox",
                url: "/inbox",
            },
        ]);
        expect(storage.getItem(PINNED_PAGES_STORAGE_KEY)).toContain('"url":"/inbox"');
    });

    it("removes a pin and compacts its order", () => {
        installStorageMock();

        addPinnedPage({ url: "/inbox" });
        addPinnedPage({ url: "/workspaces" });

        expect(removePinnedPage("/inbox")).toBe(true);
        expect($pinnedPages.get()).toEqual([
            {
                icon: "Cloud",
                order: 0,
                title: "Workspaces",
                url: "/workspaces",
            },
        ]);
    });

    it("reorders pins", () => {
        installStorageMock();

        addPinnedPage({ url: "/inbox" });
        addPinnedPage({ url: "/workspaces" });
        addPinnedPage({ url: "/settings" });

        expect(movePinnedPage(2, 0)).toBe(true);
        expect($pinnedPages.get().map((page) => page.url)).toEqual([
            "/settings",
            "/inbox",
            "/workspaces",
        ]);
        expect($pinnedPages.get().map((page) => page.order)).toEqual([0, 1, 2]);
    });

    it("loads and normalizes persisted pins", () => {
        const storage = installStorageMock();
        storage.setItem(PINNED_PAGES_STORAGE_KEY, JSON.stringify([
            { url: "/inbox", title: "Inbox", icon: "Inbox", order: 1 },
            { url: "/inbox", title: "Duplicate", icon: "Inbox", order: 2 },
            { url: "/alice/demo/issues/17", order: 0 },
        ]));

        hydratePinnedPages();

        expect($pinnedPages.get()).toEqual([
            {
                icon: "CheckCircle2",
                order: 0,
                title: "alice/demo · Issue #17",
                url: "/alice/demo/issues/17",
            },
            {
                icon: "Inbox",
                order: 1,
                title: "Inbox",
                url: "/inbox",
            },
        ]);
    });

    it("falls back to an empty list when storage is corrupted", () => {
        const storage = installStorageMock();
        storage.setItem(PINNED_PAGES_STORAGE_KEY, "{bad json");

        hydratePinnedPages();

        expect($pinnedPages.get()).toEqual([]);
    });

    it("enforces the max pin limit", () => {
        installStorageMock();

        for (let index = 0; index < PINNED_PAGES_LIMIT; index += 1) {
            expect(addPinnedPage({ url: `/settings/variables?pin=${index}` })).toBe(true);
        }

        expect(addPinnedPage({ url: "/inbox" })).toBe(false);
        expect($pinnedPages.get()).toHaveLength(PINNED_PAGES_LIMIT);
    });

    it("includes the selected ref in code page titles", () => {
        installStorageMock();

        expect(addPinnedPage({ url: "/alice/demo/code?path=src%2Fapp.ts&ref=feature" })).toBe(true);
        expect($pinnedPages.get()).toEqual([
            {
                icon: "FileText",
                order: 0,
                title: "alice/demo · src/app.ts @ feature",
                url: "/alice/demo/code?path=src%2Fapp.ts&ref=feature",
            },
        ]);
    });

    it("refreshes derived metadata for stored reserved top-level routes", () => {
        const storage = installStorageMock();
        storage.setItem(PINNED_PAGES_STORAGE_KEY, JSON.stringify([
            {
                icon: "FileText",
                order: 0,
                title: "@coming-soon",
                url: "/coming-soon?source=waitlist",
            },
        ]));

        hydratePinnedPages();

        expect($pinnedPages.get()).toEqual([
            {
                icon: "FileText",
                order: 0,
                title: "Coming soon",
                url: "/coming-soon?source=waitlist",
            },
        ]);
    });

    it("refreshes stored code pin titles when the ref was previously omitted", () => {
        const storage = installStorageMock();
        storage.setItem(PINNED_PAGES_STORAGE_KEY, JSON.stringify([
            {
                icon: "FileText",
                order: 0,
                title: "alice/demo · src/app.ts",
                url: "/alice/demo/code?path=src%2Fapp.ts&ref=feature",
            },
        ]));

        hydratePinnedPages();

        expect($pinnedPages.get()).toEqual([
            {
                icon: "FileText",
                order: 0,
                title: "alice/demo · src/app.ts @ feature",
                url: "/alice/demo/code?path=src%2Fapp.ts&ref=feature",
            },
        ]);
    });

    it("preserves stored custom pin metadata", () => {
        const storage = installStorageMock();
        storage.setItem(PINNED_PAGES_STORAGE_KEY, JSON.stringify([
            {
                icon: "Cloud",
                order: 0,
                title: "My inbox",
                url: "/inbox",
            },
        ]));

        hydratePinnedPages();

        expect($pinnedPages.get()).toEqual([
            {
                icon: "Cloud",
                order: 0,
                title: "My inbox",
                url: "/inbox",
            },
        ]);
    });

    it("repairs invalid stored icon keys", () => {
        const storage = installStorageMock();
        storage.setItem(PINNED_PAGES_STORAGE_KEY, JSON.stringify([
            {
                icon: "NotARealIcon",
                order: 0,
                title: "My inbox",
                url: "/inbox",
            },
        ]));

        hydratePinnedPages();

        expect($pinnedPages.get()).toEqual([
            {
                icon: "Inbox",
                order: 0,
                title: "My inbox",
                url: "/inbox",
            },
        ]);
    });

    it("refreshes stale titles without overwriting a custom icon", () => {
        const storage = installStorageMock();
        storage.setItem(PINNED_PAGES_STORAGE_KEY, JSON.stringify([
            {
                icon: "Cloud",
                order: 0,
                title: "@coming-soon",
                url: "/coming-soon",
            },
        ]));

        hydratePinnedPages();

        expect($pinnedPages.get()).toEqual([
            {
                icon: "Cloud",
                order: 0,
                title: "Coming soon",
                url: "/coming-soon",
            },
        ]);
    });

    it("does not add pins before the storage scope is resolved", () => {
        const storage = installStorageMock();
        resetPinnedPages();

        expect(addPinnedPage({ url: "/inbox" })).toBe(false);
        expect($pinnedPages.get()).toEqual([]);
        expect(storage.getItem(PINNED_PAGES_STORAGE_KEY)).toBeNull();
    });
});
