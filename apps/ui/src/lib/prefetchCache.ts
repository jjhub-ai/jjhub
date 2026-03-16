const DEFAULT_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 64;
const MAX_CONCURRENT_PREFETCHES = 3;
const HOVER_PREFETCH_DELAY_MS = 50;

type CacheEntry<T> = {
    hasValue: boolean;
    value?: T;
    expiresAt: number;
    promise?: Promise<T>;
    controller?: AbortController;
};

type PrefetchJob = {
    key: string;
    started: boolean;
    cancelled: boolean;
    cancel: () => void;
    run: () => Promise<void>;
};

export type PrefetchHandle = {
    cancel: () => void;
};

type HoverPrefetchOptions = {
    delayMs?: number;
};

type ConnectionAwareNavigator = Navigator & {
    connection?: {
        effectiveType?: string;
        saveData?: boolean;
    };
};

const cache = new Map<string, CacheEntry<unknown>>();
const queuedPrefetches = new Map<string, PrefetchJob>();
let activePrefetches = 0;

const noopHandle: PrefetchHandle = {
    cancel: () => {},
};

function now(): number {
    return Date.now();
}

function isAbortError(error: unknown): boolean {
    return (
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError")
    );
}

function touchEntry<T>(key: string, entry: CacheEntry<T>): CacheEntry<T> {
    cache.delete(key);
    cache.set(key, entry as CacheEntry<unknown>);
    return entry;
}

function getEntry<T>(key: string): CacheEntry<T> | undefined {
    return cache.get(key) as CacheEntry<T> | undefined;
}

function isFresh(entry: CacheEntry<unknown>): boolean {
    return entry.hasValue && entry.expiresAt > now();
}

function pruneCache(): void {
    const timestamp = now();

    for (const [key, entry] of cache) {
        if (entry.hasValue && entry.expiresAt <= timestamp && !entry.promise) {
            cache.delete(key);
        }
    }

    if (cache.size <= MAX_CACHE_ENTRIES) {
        return;
    }

    for (const [key, entry] of cache) {
        if (cache.size <= MAX_CACHE_ENTRIES) {
            break;
        }
        if (!entry.promise) {
            cache.delete(key);
        }
    }
}

function shouldPrefetch(): boolean {
    if (typeof navigator === "undefined") {
        return false;
    }

    const connection = (navigator as ConnectionAwareNavigator).connection;
    if (navigator.onLine === false) {
        return false;
    }
    if (connection?.saveData) {
        return false;
    }
    if (connection?.effectiveType && (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g")) {
        return false;
    }
    return true;
}

function startNextPrefetch(): void {
    if (activePrefetches >= MAX_CONCURRENT_PREFETCHES) {
        return;
    }

    const iterator = queuedPrefetches.entries().next();
    if (iterator.done) {
        return;
    }

    const [key, job] = iterator.value;
    queuedPrefetches.delete(key);
    if (job.cancelled) {
        startNextPrefetch();
        return;
    }

    activePrefetches += 1;
    void job.run();
}

export function clearPrefetchCache(): void {
    for (const [, entry] of cache) {
        entry.controller?.abort();
    }
    cache.clear();

    for (const [, job] of queuedPrefetches) {
        job.cancel();
    }
    queuedPrefetches.clear();
    activePrefetches = 0;
}

export function getCachedValue<T>(key: string): T | undefined {
    pruneCache();

    const entry = getEntry<T>(key);
    if (!entry) {
        return undefined;
    }

    if (!isFresh(entry)) {
        if (!entry.promise) {
            cache.delete(key);
        }
        return undefined;
    }

    touchEntry(key, entry);
    return entry.value as T;
}

export function setCachedValue<T>(
    key: string,
    value: T,
    options: { ttlMs?: number } = {},
): T {
    const entry: CacheEntry<T> = {
        hasValue: true,
        value,
        expiresAt: now() + (options.ttlMs ?? DEFAULT_TTL_MS),
    };
    touchEntry(key, entry);
    pruneCache();
    return value;
}

export function clearCachedValue(key: string): void {
    const entry = getEntry(key);
    entry?.controller?.abort();
    cache.delete(key);
}

export function loadCachedValue<T>(
    key: string,
    loader: (signal: AbortSignal) => Promise<T>,
    options: { ttlMs?: number; controller?: AbortController } = {},
): Promise<T> {
    pruneCache();

    const cachedValue = getCachedValue<T>(key);
    if (cachedValue !== undefined) {
        return Promise.resolve(cachedValue);
    }

    const existing = getEntry<T>(key);
    if (existing?.promise && !existing.controller?.signal.aborted) {
        touchEntry(key, existing);
        return existing.promise;
    }

    if (existing?.controller?.signal.aborted) {
        cache.delete(key);
    }

    const controller = options.controller ?? new AbortController();
    const signal = controller.signal;

    const promise = loader(signal)
        .then((value) => {
            setCachedValue(key, value, { ttlMs: options.ttlMs });
            return value;
        })
        .catch((error) => {
            const current = getEntry<T>(key);
            if (current?.promise === promise) {
                cache.delete(key);
            }
            throw error;
        });

    touchEntry(key, {
        hasValue: false,
        expiresAt: 0,
        promise,
        controller,
    });

    return promise;
}

export function loadFreshValue<T>(
    key: string,
    loader: (signal: AbortSignal) => Promise<T>,
    options: { ttlMs?: number; controller?: AbortController } = {},
): Promise<T> {
    clearCachedValue(key);
    return loadCachedValue(key, loader, options);
}

export function prefetchValue<T>(
    key: string,
    loader: (signal: AbortSignal) => Promise<T>,
    options: { ttlMs?: number } = {},
): PrefetchHandle {
    pruneCache();

    if (!shouldPrefetch()) {
        return noopHandle;
    }

    const cachedValue = getCachedValue<T>(key);
    if (cachedValue !== undefined) {
        return noopHandle;
    }

    const existing = getEntry<T>(key);
    if (existing?.promise && !existing.controller?.signal.aborted) {
        return noopHandle;
    }

    if (queuedPrefetches.has(key)) {
        return noopHandle;
    }

    const controller = new AbortController();

    const job: PrefetchJob = {
        key,
        started: false,
        cancelled: false,
        cancel: () => {
            if (job.cancelled) {
                return;
            }
            job.cancelled = true;
            if (job.started) {
                controller.abort();
            } else {
                queuedPrefetches.delete(key);
            }
        },
        run: async () => {
            job.started = true;
            try {
                if (!job.cancelled) {
                    await loadCachedValue(key, loader, { ttlMs: options.ttlMs, controller });
                }
            } catch (error) {
                if (!isAbortError(error)) {
                    console.error(`Failed to prefetch ${key}`, error);
                }
            } finally {
                activePrefetches = Math.max(0, activePrefetches - 1);
                startNextPrefetch();
            }
        },
    };

    if (activePrefetches < MAX_CONCURRENT_PREFETCHES) {
        activePrefetches += 1;
        void job.run();
    } else {
        queuedPrefetches.set(key, job);
    }

    return {
        cancel: job.cancel,
    };
}

export function createPrefetchResource<TArgs extends readonly unknown[], TResult>(options: {
    key: (...args: TArgs) => string;
    load: (signal: AbortSignal, ...args: TArgs) => Promise<TResult>;
    ttlMs?: number;
}) {
    return {
        key: (...args: TArgs) => options.key(...args),
        peek: (...args: TArgs): TResult | undefined => getCachedValue<TResult>(options.key(...args)),
        invalidate: (...args: TArgs): void => {
            clearCachedValue(options.key(...args));
        },
        load: (...args: TArgs): Promise<TResult> =>
            loadCachedValue<TResult>(
                options.key(...args),
                (signal) => options.load(signal, ...args),
                { ttlMs: options.ttlMs },
            ),
        reload: (...args: TArgs): Promise<TResult> =>
            loadFreshValue<TResult>(
                options.key(...args),
                (signal) => options.load(signal, ...args),
                { ttlMs: options.ttlMs },
            ),
        prefetch: (...args: TArgs): PrefetchHandle =>
            prefetchValue<TResult>(
                options.key(...args),
                (signal) => options.load(signal, ...args),
                { ttlMs: options.ttlMs },
            ),
    };
}

export function createHoverPrefetchHandlers(
    startPrefetch: () => PrefetchHandle | void,
    options: HoverPrefetchOptions = {},
) {
    const delayMs = options.delayMs ?? HOVER_PREFETCH_DELAY_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let handle: PrefetchHandle | undefined;

    const cancel = () => {
        if (timer !== undefined) {
            clearTimeout(timer);
            timer = undefined;
        }
        handle?.cancel();
        handle = undefined;
    };

    const begin = () => {
        if (timer !== undefined || handle) {
            return;
        }

        timer = setTimeout(() => {
            timer = undefined;
            handle = startPrefetch() ?? undefined;
        }, delayMs);
    };

    return {
        onMouseEnter: begin,
        onMouseLeave: cancel,
        onFocus: begin,
        onBlur: cancel,
        cancel,
    };
}

export const prefetchCacheDebug = {
    get activePrefetches() {
        return activePrefetches;
    },
    get queuedPrefetches() {
        return queuedPrefetches.size;
    },
};
