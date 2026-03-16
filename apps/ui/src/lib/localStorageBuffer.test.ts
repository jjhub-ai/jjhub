// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { $dirtyFiles, resetEditorState } from "./editorState";
import {
    buildLocalBufferKey,
    cleanupStaleBufferedContent,
    clearBufferedContent,
    getBufferedContent,
    queueBufferedWrite,
} from "./localStorageBuffer";

describe("localStorageBuffer", () => {
    const createStorageMock = () => {
        const state = new Map<string, string>();
        return {
            clear: () => state.clear(),
            getItem: (key: string) => state.get(key) ?? null,
            key: (index: number) => Array.from(state.keys())[index] ?? null,
            removeItem: (key: string) => state.delete(key),
            setItem: (key: string, value: string) => {
                state.set(key, value);
            },
            get length() {
                return state.size;
            },
        };
    };

    beforeEach(() => {
        Object.defineProperty(window, "localStorage", {
            configurable: true,
            value: createStorageMock(),
        });
        window.localStorage.clear();
        resetEditorState();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("writes debounced local drafts using the repo-scoped key format", () => {
        const key = buildLocalBufferKey({ owner: "alice", repo: "demo" }, "src/app.ts");

        queueBufferedWrite(key, "draft", "src/app.ts", 250);

        expect(getBufferedContent(key)).toBeNull();

        vi.advanceTimersByTime(250);

        expect(getBufferedContent(key)).toBe("draft");
        expect($dirtyFiles.get()).toEqual({
            "src/app.ts": true,
        });
    });

    it("clears drafts and removes stale entries", () => {
        const key = buildLocalBufferKey({ owner: "alice", repo: "demo" }, "README.md");

        queueBufferedWrite(key, "draft", "README.md", 0);
        vi.runAllTimers();

        expect(getBufferedContent(key)).toBe("draft");

        clearBufferedContent(key, "README.md");
        expect(getBufferedContent(key)).toBeNull();
        expect($dirtyFiles.get()).toEqual({});

        const staleTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000);
        window.localStorage.setItem(
            key,
            JSON.stringify({
                content: "stale",
                updatedAt: staleTimestamp,
            }),
        );

        cleanupStaleBufferedContent(Date.now());

        expect(window.localStorage.getItem(key)).toBeNull();
    });
});
