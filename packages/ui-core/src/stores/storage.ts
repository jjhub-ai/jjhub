/**
 * Platform-agnostic storage abstraction.
 *
 * In a browser, this uses localStorage by default. In a terminal UI,
 * the storage backend can be swapped to a file-based or in-memory store
 * via `configureStorage()`.
 */

import { atom } from "nanostores";

export type StorageBackend = {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
};

let storageBackend: StorageBackend | null = null;

/**
 * Configure the storage backend used by stores.
 * If not called, stores will attempt to use window.localStorage
 * and fall back to no-op in non-browser environments.
 */
export function configureStorage(backend: StorageBackend): void {
    storageBackend = backend;
}

function getStorage(): StorageBackend | null {
    if (storageBackend) {
        return storageBackend;
    }
    if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage;
    }
    return null;
}

export function readStoredString(key: string): string | null {
    try {
        return getStorage()?.getItem(key) ?? null;
    } catch {
        return null;
    }
}

export function writeStoredString(key: string, value: string): void {
    try {
        getStorage()?.setItem(key, value);
    } catch {
        // Ignore storage failures and keep the in-memory value.
    }
}

export function removeStoredString(key: string): void {
    try {
        getStorage()?.removeItem(key);
    } catch {
        // Ignore storage errors.
    }
}

export function readStoredJSON<T>(key: string): T | null {
    const raw = readStoredString(key);
    if (raw == null) {
        return null;
    }
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

export function writeStoredJSON(key: string, value: unknown): void {
    writeStoredString(key, JSON.stringify(value));
}

/**
 * Create a nanostore atom that persists its value to storage.
 */
export function createPersistentAtom<T>(key: string, fallback: T) {
    const stored = readStoredJSON<T>(key);
    const store = atom<T>(stored ?? fallback);
    store.listen((value) => {
        writeStoredJSON(key, value);
    });
    return store;
}
