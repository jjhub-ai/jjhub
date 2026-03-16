import { atom } from "nanostores";
import {
    describePinnedPage,
    isPinnedPageIconKey,
    normalizePinnedPageUrl,
    type PinnedPageIconKey,
} from "../lib/pinnedPages";

export type PinnedPage = {
    icon?: PinnedPageIconKey;
    order: number;
    title: string;
    url: string;
};

export type PinnedPageInput = {
    icon?: PinnedPageIconKey;
    title?: string;
    url: string;
};

export const PINNED_PAGES_LIMIT = 10;
export const PINNED_PAGES_STORAGE_KEY = "jjhub.sidebar.pinned-pages";
export const $pinnedPagesReady = atom(false);

let storageScope: string | null = null;

function scopedStorageKey(): string | null {
    if (storageScope === null) {
        return null;
    }

    return storageScope === "anonymous"
        ? PINNED_PAGES_STORAGE_KEY
        : `${PINNED_PAGES_STORAGE_KEY}:${storageScope}`;
}

function getLegacyPinnedPageDescriptor(url: string): { icon?: PinnedPageIconKey; title: string } | null {
    const normalizedUrl = normalizePinnedPageUrl(url);
    const parsed = new URL(normalizedUrl, "https://jjhub.local");

    if (parsed.pathname === "/coming-soon") {
        return {
            icon: "FileText",
            title: "@coming-soon",
        };
    }

    if (parsed.pathname === "/sessions") {
        return {
            icon: "FileText",
            title: "@sessions",
        };
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length >= 3 && segments[2] === "code" && parsed.searchParams.has("ref")) {
        parsed.searchParams.delete("ref");
        const legacyDescriptor = describePinnedPage(`${parsed.pathname}${parsed.search}`);
        return {
            icon: legacyDescriptor.icon,
            title: legacyDescriptor.title,
        };
    }

    return null;
}

function normalizePinnedPage(value: unknown, fallbackOrder: number): PinnedPage | null {
    if (!value || typeof value !== "object") {
        return null;
    }

    const candidate = value as Partial<PinnedPage>;
    if (typeof candidate.url !== "string" || !candidate.url.trim()) {
        return null;
    }

    const descriptor = describePinnedPage(candidate.url);
    const order = Number.isFinite(candidate.order) ? Number(candidate.order) : fallbackOrder;
    const title = typeof candidate.title === "string" && candidate.title.trim()
        ? candidate.title.trim()
        : descriptor.title;
    const icon = isPinnedPageIconKey(candidate.icon) ? candidate.icon : descriptor.icon;
    const legacyDescriptor = getLegacyPinnedPageDescriptor(candidate.url);
    const shouldRefreshDerivedTitle = Boolean(legacyDescriptor && title === legacyDescriptor.title);
    const shouldRefreshDerivedIcon = Boolean(legacyDescriptor && (!candidate.icon || icon === legacyDescriptor.icon));

    return {
        icon: shouldRefreshDerivedIcon ? descriptor.icon : icon,
        order,
        title: shouldRefreshDerivedTitle ? descriptor.title : title,
        url: descriptor.url,
    };
}

function normalizePinnedPages(value: unknown): PinnedPage[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const byUrl = new Map<string, PinnedPage>();

    value.forEach((candidate, index) => {
        const normalized = normalizePinnedPage(candidate, index);
        if (!normalized || byUrl.has(normalized.url)) {
            return;
        }

        byUrl.set(normalized.url, normalized);
    });

    return Array.from(byUrl.values())
        .sort((left, right) => left.order - right.order)
        .slice(0, PINNED_PAGES_LIMIT)
        .map((page, index) => ({
            ...page,
            order: index,
        }));
}

function readStoredPins(): PinnedPage[] {
    if (typeof window === "undefined") {
        return [];
    }

    try {
        const storageKey = scopedStorageKey();
        if (!storageKey) {
            return [];
        }

        const raw = window.localStorage.getItem(storageKey);
        if (!raw) {
            return [];
        }

        return normalizePinnedPages(JSON.parse(raw));
    } catch {
        return [];
    }
}

function writeStoredPins(pages: readonly PinnedPage[]): void {
    if (typeof window === "undefined") {
        return;
    }

    try {
        const storageKey = scopedStorageKey();
        if (!storageKey) {
            return;
        }

        window.localStorage.setItem(storageKey, JSON.stringify(pages));
    } catch {
        // Ignore storage failures and keep the in-memory state.
    }
}

function nextPinnedPage(page: PinnedPageInput, order: number): PinnedPage {
    const descriptor = describePinnedPage(page.url);

    return {
        icon: page.icon ?? descriptor.icon,
        order,
        title: page.title?.trim() || descriptor.title,
        url: descriptor.url,
    };
}

export const $pinnedPages = atom<PinnedPage[]>([]);

$pinnedPages.listen((pages) => {
    writeStoredPins(pages);
});

export function hydratePinnedPages(): PinnedPage[] {
    const pages = readStoredPins();
    $pinnedPages.set(pages);
    return pages;
}

export function setPinnedPagesScope(scope: string | null | undefined): void {
    const normalizedScope = typeof scope === "string" && scope.trim()
        ? scope.trim()
        : "anonymous";

    if (storageScope === normalizedScope && $pinnedPagesReady.get()) {
        return;
    }

    storageScope = normalizedScope;
    $pinnedPagesReady.set(true);
    hydratePinnedPages();
}

export function isPinnedPage(url: string): boolean {
    const normalizedUrl = normalizePinnedPageUrl(url);
    return $pinnedPages.get().some((page) => page.url === normalizedUrl);
}

export function addPinnedPage(page: PinnedPageInput): boolean {
    if (!$pinnedPagesReady.get()) {
        return false;
    }

    const pages = $pinnedPages.get();
    const normalizedUrl = normalizePinnedPageUrl(page.url);

    if (pages.some((entry) => entry.url === normalizedUrl) || pages.length >= PINNED_PAGES_LIMIT) {
        return false;
    }

    $pinnedPages.set([
        ...pages,
        nextPinnedPage(page, pages.length),
    ]);

    return true;
}

export function removePinnedPage(url: string): boolean {
    if (!$pinnedPagesReady.get()) {
        return false;
    }

    const pages = $pinnedPages.get();
    const normalizedUrl = normalizePinnedPageUrl(url);
    const nextPages = pages
        .filter((page) => page.url !== normalizedUrl)
        .map((page, index) => ({
            ...page,
            order: index,
        }));

    if (nextPages.length === pages.length) {
        return false;
    }

    $pinnedPages.set(nextPages);
    return true;
}

export function reorderPinnedPages(pages: PinnedPage[]): void {
    if (!$pinnedPagesReady.get()) {
        return;
    }

    $pinnedPages.set(normalizePinnedPages(
        pages.map((page, index) => ({
            ...page,
            order: index,
        })),
    ));
}

export function movePinnedPage(fromIndex: number, toIndex: number): boolean {
    if (!$pinnedPagesReady.get()) {
        return false;
    }

    const pages = $pinnedPages.get();
    if (
        fromIndex < 0
        || fromIndex >= pages.length
        || toIndex < 0
        || toIndex >= pages.length
        || fromIndex === toIndex
    ) {
        return false;
    }

    const nextPages = pages.slice();
    const [moved] = nextPages.splice(fromIndex, 1);
    if (!moved) {
        return false;
    }

    nextPages.splice(toIndex, 0, moved);
    reorderPinnedPages(nextPages);
    return true;
}

export function togglePinnedPage(page: PinnedPageInput): boolean {
    if (!$pinnedPagesReady.get()) {
        return false;
    }

    if (isPinnedPage(page.url)) {
        removePinnedPage(page.url);
        return false;
    }

    return addPinnedPage(page);
}

export function resetPinnedPages(): void {
    storageScope = null;
    $pinnedPagesReady.set(false);
    $pinnedPages.set([]);
}
