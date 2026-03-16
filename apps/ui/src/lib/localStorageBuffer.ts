import type { RepoContext } from './repoContext';
import { setDirtyFile } from './editorState';

const BUFFER_PREFIX = 'jjhub.editor.buffer';
const STALE_ENTRY_MS = 7 * 24 * 60 * 60 * 1000;
const pendingWrites = new Map<string, number>();

type BufferEntry = {
    content: string;
    updatedAt: number;
};

function readEntry(storageKey: string): BufferEntry | null {
    if (typeof window === 'undefined') {
        return null;
    }
    try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw == null) {
            return null;
        }
        const parsed = JSON.parse(raw) as BufferEntry;
        if (typeof parsed?.content !== 'string' || typeof parsed?.updatedAt !== 'number') {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

function writeEntry(storageKey: string, entry: BufferEntry): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    try {
        window.localStorage.setItem(storageKey, JSON.stringify(entry));
        return true;
    } catch {
        return false;
    }
}

export function buildLocalBufferKey(context: RepoContext, path: string): string {
    return `${BUFFER_PREFIX}:${context.owner}/${context.repo}/${path}`;
}

export function getBufferedContent(storageKey: string): string | null {
    return readEntry(storageKey)?.content ?? null;
}

export function queueBufferedWrite(storageKey: string, content: string, dirtyKey: string, debounceMs = 250): void {
    if (typeof window === 'undefined') {
        return;
    }

    const pending = pendingWrites.get(storageKey);
    if (pending) {
        window.clearTimeout(pending);
    }

    const timeout = window.setTimeout(() => {
        pendingWrites.delete(storageKey);
        const didWrite = writeEntry(storageKey, {
            content,
            updatedAt: Date.now(),
        });
        if (didWrite) {
            setDirtyFile(dirtyKey, true);
        }
    }, debounceMs);

    pendingWrites.set(storageKey, timeout);
}

export function clearBufferedContent(storageKey: string, dirtyKey: string): void {
    if (typeof window !== 'undefined') {
        const pending = pendingWrites.get(storageKey);
        if (pending) {
            window.clearTimeout(pending);
            pendingWrites.delete(storageKey);
        }
        try {
            window.localStorage.removeItem(storageKey);
        } catch {
            // Ignore storage errors and clear the dirty state anyway.
        }
    }
    setDirtyFile(dirtyKey, false);
}

export function cleanupStaleBufferedContent(now = Date.now()): void {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        const storage = window.localStorage;
        for (let index = storage.length - 1; index >= 0; index -= 1) {
            const key = storage.key(index);
            if (!key?.startsWith(`${BUFFER_PREFIX}:`)) {
                continue;
            }
            const entry = readEntry(key);
            if (!entry || now - entry.updatedAt > STALE_ENTRY_MS) {
                storage.removeItem(key);
            }
        }
    } catch {
        // Best-effort cleanup only.
    }
}
