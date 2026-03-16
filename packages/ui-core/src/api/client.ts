/**
 * Platform-agnostic API client for JJHub.
 *
 * Works in both browser and non-browser environments (e.g. terminal UIs).
 * The client is configured via `configureApiClient()` which sets the base URL
 * and token provider. In a browser, the base URL can be "" (same-origin) and
 * the token can come from localStorage. In a terminal UI, the base URL is the
 * full API origin and the token comes from an env var or config file.
 */

import type { RepoContext } from "./types";

export type ApiClientConfig = {
    /**
     * Base URL for API requests (e.g. "https://api.jjhub.tech" or "" for same-origin).
     */
    baseUrl: string;

    /**
     * Returns the auth token string (e.g. "token jjhub_abc123") or null if unauthenticated.
     */
    getToken: () => string | null;

    /**
     * Custom fetch implementation. Defaults to globalThis.fetch.
     */
    fetch?: typeof globalThis.fetch;
};

let config: ApiClientConfig = {
    baseUrl: "",
    getToken: () => null,
};

/**
 * Configure the API client. Must be called before any API calls.
 */
export function configureApiClient(options: Partial<ApiClientConfig>): void {
    config = {
        ...config,
        ...options,
    };
}

/**
 * Get the current API client configuration.
 */
export function getApiClientConfig(): Readonly<ApiClientConfig> {
    return config;
}

function buildHeaders(init?: HeadersInit): Headers {
    const headers = new Headers(init ?? undefined);
    if (!headers.has("Authorization")) {
        const token = config.getToken();
        if (token) {
            headers.set("Authorization", token);
        }
    }
    return headers;
}

/**
 * Make an authenticated API request.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = buildHeaders(init.headers);
    const url = `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const fetchFn = config.fetch ?? globalThis.fetch;
    return fetchFn(url, {
        ...init,
        headers,
    });
}

/**
 * Build the API path for a repo-scoped endpoint.
 */
export function repoApiPath(pathSuffix: string, context: RepoContext): string {
    const base = `/api/repos/${encodeURIComponent(context.owner)}/${encodeURIComponent(context.repo)}`;
    if (!pathSuffix || pathSuffix === "/") {
        return base;
    }
    const suffix = pathSuffix.startsWith("/") ? pathSuffix : `/${pathSuffix}`;
    return `${base}${suffix}`;
}

/**
 * Check if a RepoContext has both owner and repo populated.
 */
export function hasRepoContext(context: RepoContext): boolean {
    return Boolean(context.owner && context.repo);
}

/**
 * Make an authenticated API request scoped to a repository.
 */
export async function repoApiFetch(
    pathSuffix: string,
    init: RequestInit = {},
    context: RepoContext,
): Promise<Response> {
    if (!hasRepoContext(context)) {
        return new Response(
            JSON.stringify({
                message: "Repository context is required for repo-scoped API requests.",
            }),
            {
                status: 400,
                headers: { "Content-Type": "application/json" },
            },
        );
    }

    return apiFetch(repoApiPath(pathSuffix, context), init);
}

/**
 * Make an authenticated write (POST/PUT/PATCH/DELETE) request scoped to a repository.
 */
export async function repoApiWrite(
    pathSuffix: string,
    body: unknown,
    context: RepoContext,
    method: "POST" | "PUT" | "PATCH" | "DELETE" = "POST",
): Promise<Response> {
    return repoApiFetch(
        pathSuffix,
        {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        },
        context,
    );
}
