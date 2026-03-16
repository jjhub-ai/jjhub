import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    clearPrefetchCache,
    clearCachedValue,
    createPrefetchResource,
    getCachedValue,
    loadCachedValue,
    prefetchValue,
} from "./prefetchCache";

describe("prefetchCache", () => {
    beforeEach(() => {
        clearPrefetchCache();
    });

    afterEach(() => {
        clearPrefetchCache();
    });

    it("drops cancelled prefetches instead of caching them", async () => {
        const loader = vi.fn((signal: AbortSignal) => {
            return new Promise<string>((resolve, reject) => {
                signal.addEventListener("abort", () => {
                    reject(new DOMException("Aborted", "AbortError"));
                });

                setTimeout(() => resolve("prefetched"), 25);
            });
        });

        const handle = prefetchValue("issue:42", loader);
        expect(loader).toHaveBeenCalledTimes(1);

        handle.cancel();
        await Promise.resolve();

        expect(getCachedValue("issue:42")).toBeUndefined();
    });

    it("aborts in-flight loads when a cache entry is cleared", async () => {
        const loader = vi.fn((signal: AbortSignal) => {
            return new Promise<string>((resolve, reject) => {
                signal.addEventListener("abort", () => {
                    reject(new DOMException("Aborted", "AbortError"));
                });

                setTimeout(() => resolve("stale"), 25);
            });
        });

        const pending = loadCachedValue("issue:42", loader);
        clearCachedValue("issue:42");

        await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    });

    it("reload bypasses a fresh cached value", async () => {
        const loader = vi
            .fn<(signal: AbortSignal) => Promise<string>>()
            .mockResolvedValueOnce("prefetched")
            .mockResolvedValueOnce("fresh");

        const resource = createPrefetchResource({
            key: () => "route:issue:42",
            load: loader,
        });

        await expect(resource.load()).resolves.toBe("prefetched");
        await expect(resource.reload()).resolves.toBe("fresh");
        expect(loader).toHaveBeenCalledTimes(2);
    });
});
