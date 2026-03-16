import { clearPrefetchCache } from "./prefetchCache";

export type RepoContext = {
    owner: string;
    repo: string;
};

export function hasRepoContext(context: RepoContext): boolean {
    return Boolean(context.owner && context.repo);
}

/** Routes that are NOT owner/repo patterns — used to avoid false positives. */
export const RESERVED_FIRST_SEGMENTS = new Set([
    "admin",
    "inbox",
    "integrations",
    "login",
    "marketing",
    "orgs",
    "queue",
    "readout",
    "repo",
    "search",
    "sessions",
    "settings",
    "tools",
    "users",
    "waitlist",
    "workspaces",
    "thank-you",
    "coming-soon",
]);

export function getCurrentRepoContext(pathname?: string): RepoContext {
    const resolvedPathname =
        pathname ??
        (typeof window !== "undefined" ? window.location.pathname : "");

    const segments = resolvedPathname.split("/").filter(Boolean);

    // New pattern: /:owner/:repo/...
    if (segments.length >= 2 && !RESERVED_FIRST_SEGMENTS.has(segments[0])) {
        return {
            owner: segments[0],
            repo: segments[1],
        };
    }

    // Legacy pattern: /repo/:repo/... (backward compat)
    if (segments[0] === "repo" && segments[1]) {
        return {
            owner: "",
            repo: segments[1],
        };
    }

    return {
        owner: "",
        repo: "",
    };
}

export function repoApiPath(pathSuffix: string, context = getCurrentRepoContext()): string {
    const base = `/api/repos/${encodeURIComponent(context.owner)}/${encodeURIComponent(context.repo)}`;
    if (!pathSuffix || pathSuffix === "/") {
        return base;
    }
    const suffix = pathSuffix.startsWith("/") ? pathSuffix : `/${pathSuffix}`;
    return `${base}${suffix}`;
}

function readStoredValue(key: string): string | null {
    if (typeof window === "undefined") {
        return null;
    }
    try {
        const storage = window.localStorage;
        if (!storage || typeof storage.getItem !== "function") {
            return null;
        }
        return storage.getItem(key);
    } catch {
        return null;
    }
}

function writeStoredValue(key: string, value: string): boolean {
    if (typeof window === "undefined") {
        return false;
    }
    try {
        const storage = window.localStorage;
        if (!storage || typeof storage.setItem !== "function") {
            return false;
        }
        storage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

function removeStoredValue(key: string): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        const storage = window.localStorage;
        if (!storage || typeof storage.removeItem !== "function") {
            return;
        }
        storage.removeItem(key);
    } catch {
        // Ignore storage access errors and continue logout/login flows.
    }
}

export function getStoredToken(): string | null {
    const token = readStoredValue("jjhub_token");
    if (!token) {
        return null;
    }
    const trimmed = token.trim();
    if (!trimmed) {
        return null;
    }
    if (trimmed.startsWith("token ") || trimmed.startsWith("Bearer ")) {
        return trimmed;
    }
    return `token ${trimmed}`;
}

export function setStoredToken(token: string): boolean {
    return writeStoredValue("jjhub_token", token);
}

export function withAuthHeaders(headers?: HeadersInit): Headers {
    const merged = new Headers(headers ?? undefined);
    if (!merged.has("Authorization")) {
        const token = getStoredToken();
        if (token) {
            merged.set("Authorization", token);
        }
    }
    return merged;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = withAuthHeaders(init.headers);
    const url = path.startsWith("/") ? path : `/${path}`;
    try {
        return await fetch(url, {
            credentials: "include",
            ...init,
            headers,
        });
    } catch (error) {
        if (error instanceof Error) {
            import("./errorReporting").then(({ reportError }) => {
                reportError(error as Error, { api_path: path });
            }).catch(() => {});
        }
        throw error;
    }
}

export async function repoApiFetch(pathSuffix: string, init: RequestInit = {}, context = getCurrentRepoContext()): Promise<Response> {
    if (!hasRepoContext(context)) {
        console.error(`repoApiFetch called without a repository context for ${pathSuffix}`);
        return new Response(JSON.stringify({
            message: "Repository context is required for repo-scoped API requests.",
        }), {
            status: 400,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }

    const headers = withAuthHeaders(init.headers);
    try {
        return await fetch(repoApiPath(pathSuffix, context), {
            credentials: "include",
            ...init,
            headers,
        });
    } catch (error) {
        if (error instanceof Error) {
            import("./errorReporting").then(({ reportError }) => {
                reportError(error as Error, { api_path: pathSuffix });
            }).catch(() => {});
        }
        throw error;
    }
}

export async function repoApiWrite(
    pathSuffix: string,
    body: unknown,
    context = getCurrentRepoContext(),
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST',
): Promise<Response> {
    return repoApiFetch(pathSuffix, {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    }, context);
}

/**
 * Check if the user has a stored token (does not validate it).
 * Cookie-based sessions are handled implicitly by the browser.
 */
export function hasStoredToken(): boolean {
    return getStoredToken() !== null;
}

/**
 * Clear all local auth state (token from localStorage).
 * Cookie-based sessions are cleared server-side via POST /api/auth/logout.
 */
export function clearLocalAuth(): void {
    removeStoredValue("jjhub_token");
    clearPrefetchCache();
}

/**
 * Full logout: call the server to invalidate the session cookie,
 * clear localStorage token, and redirect to login.
 */
export async function logout(): Promise<void> {
    try {
        await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include",
        });
    } catch {
        // Best-effort: even if the server call fails, clear local state.
    }
    clearLocalAuth();
    window.location.href = "/login";
}
