// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

const VIEW_MODE_KEY = "jjhub.diff.view-mode";
const WHITESPACE_KEY = "jjhub.diff.whitespace";
const COLLAPSED_FILES_KEY = "jjhub.diff.collapsed-files";

async function loadModule() {
    vi.resetModules();
    return import("./diff-preferences");
}

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

describe("diff preferences store", () => {
    afterEach(() => {
        installStorageMock().clear();
        vi.restoreAllMocks();
    });

    it("defaults to unified view and showing whitespace", async () => {
        installStorageMock();
        const mod = await loadModule();

        expect(mod.$diffViewMode.get()).toBe("unified");
        expect(mod.$diffWhitespaceMode.get()).toBe("show");
        expect(mod.$collapsedDiffFiles.get()).toEqual({});
    });

    it("loads persisted values from localStorage", async () => {
        const storage = installStorageMock();
        storage.setItem(VIEW_MODE_KEY, "split");
        storage.setItem(WHITESPACE_KEY, "ignore");
        storage.setItem(COLLAPSED_FILES_KEY, JSON.stringify({ "c1:README.md": true }));

        const mod = await loadModule();

        expect(mod.$diffViewMode.get()).toBe("split");
        expect(mod.$diffWhitespaceMode.get()).toBe("ignore");
        expect(mod.$collapsedDiffFiles.get()).toEqual({ "c1:README.md": true });
    });

    it("persists updates back to localStorage", async () => {
        const storage = installStorageMock();
        const mod = await loadModule();

        mod.setDiffViewMode("split");
        mod.setDiffWhitespaceMode("ignore");
        mod.setCollapsedDiffFile("c2:go.mod", true);

        expect(storage.getItem(VIEW_MODE_KEY)).toBe("split");
        expect(storage.getItem(WHITESPACE_KEY)).toBe("ignore");
        expect(storage.getItem(COLLAPSED_FILES_KEY)).toContain("c2:go.mod");
    });

    it("falls back to defaults for corrupted localStorage", async () => {
        const storage = installStorageMock();
        storage.setItem(COLLAPSED_FILES_KEY, "{bad json");

        const mod = await loadModule();

        expect(mod.$collapsedDiffFiles.get()).toEqual({});
        expect(mod.$diffViewMode.get()).toBe("unified");
    });
});
