/**
 * Platform-agnostic API client for JJHub.
 *
 * Works in three environments:
 *   - Browser: fetch() to same-origin or a remote API URL
 *   - Terminal UI: fetch() to the full API origin
 *   - ElectroBun desktop: IPC via transportFetch() — direct in-process calls
 *
 * The client is configured via `configureApiClient()` which sets the base URL
 * and token provider. When a transport is configured (see transport.ts), the
 * IPC path bypasses the network entirely.
 */

import type { RepoContext } from "./types";
import { transportFetch, getTransportConfig } from "./transport";

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
 *
 * When the transport is set to "ipc" (ElectroBun desktop), requests bypass
 * the network and are dispatched directly to the in-process Hono server.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    // In IPC mode, delegate to the transport layer which calls the server directly
    if (getTransportConfig().mode === "ipc") {
        return transportFetch(normalizedPath, init);
    }

    // HTTP mode — standard fetch with auth headers
    const headers = buildHeaders(init.headers);
    const url = `${config.baseUrl}${normalizedPath}`;
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
