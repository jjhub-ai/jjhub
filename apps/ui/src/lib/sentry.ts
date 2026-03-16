import * as Sentry from '@sentry/solid';
import { solidRouterBrowserTracingIntegration } from '@sentry/solid/solidrouter';
import { getCurrentRepoContext } from './repoContext';
import { isFeatureEnabled } from './featureFlags';

declare const __APP_VERSION__: string;
declare const __SENTRY_APPLICATION_KEY_ENABLED__: boolean;

const DEFAULT_TRACES_SAMPLE_RATE = 0.2;
const DEFAULT_REPLAYS_SESSION_SAMPLE_RATE = 0.05;
const DEFAULT_REPLAYS_ON_ERROR_SAMPLE_RATE = 1.0;
const THIRD_PARTY_APPLICATION_KEY = 'jjhub-ui';
const IGNORED_API_PATHS = new Set(['/api/health', '/api/telemetry/errors']);
const IGNORED_ERROR_PATTERNS = [
    /AbortError/i,
    /ResizeObserver loop limit exceeded/i,
    /ResizeObserver loop completed with undelivered notifications/i,
    /Non-Error promise rejection captured/i,
];

let sentryInitialized = false;
let fetchInstrumentationInstalled = false;

type ErrorLevel = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';

type HandledErrorOptions = {
    fingerprint?: string[];
    level?: ErrorLevel;
    tags?: Record<string, string>;
};

type AuthUserContext = {
    id?: number | string;
    username?: string;
    email?: string;
    display_name?: string;
} | null;

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
    if (value == null || value.trim() === '') {
        return fallback;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
        return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
        return false;
    }
    return fallback;
}

export function parseSampleRate(value: string | undefined, fallback: number): number {
    if (value == null || value.trim() === '') {
        return fallback;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
        return fallback;
    }

    return parsed;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
    const entries = Object.entries(context).filter(([, value]) => value !== undefined);
    return Object.fromEntries(entries);
}

function resolveSentryDsn(): string | undefined {
    const raw = import.meta.env.VITE_SENTRY_DSN?.trim();
    return raw ? raw : undefined;
}

function getBrowserOrigin(): string {
    return typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
}

function getSentryTunnelPath(): string | null {
    const tunnel = import.meta.env.VITE_SENTRY_TUNNEL?.trim();
    if (!tunnel) {
        return null;
    }

    try {
        const url = new URL(tunnel, getBrowserOrigin());
        return url.pathname;
    } catch {
        return null;
    }
}

function getSentryEnvelopeTarget(): { origin: string; pathnamePrefix: string } | null {
    const dsn = resolveSentryDsn();
    if (!dsn) {
        return null;
    }

    try {
        const parsed = new URL(dsn);
        const projectId = parsed.pathname.replace(/^\/+|\/+$/g, '');
        if (!projectId) {
            return null;
        }
        return {
            origin: parsed.origin,
            pathnamePrefix: `/api/${projectId}/`,
        };
    } catch {
        return null;
    }
}

export function stripUrl(url: string): string {
    try {
        const parsed = new URL(url, getBrowserOrigin());
        if (parsed.origin === getBrowserOrigin()) {
            return parsed.pathname;
        }
        return `${parsed.origin}${parsed.pathname}`;
    } catch {
        return url.split('?')[0]?.split('#')[0] ?? url;
    }
}

export function resolveRequestUrl(input: RequestInfo | URL): string {
    if (typeof input === 'string') {
        return new URL(input, getBrowserOrigin()).toString();
    }
    if (input instanceof URL) {
        return input.toString();
    }
    return input.url;
}

function resolveRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
    const method =
        init?.method ||
        (typeof Request !== 'undefined' && input instanceof Request ? input.method : undefined) ||
        'GET';
    return method.toUpperCase();
}

export function isInternalApiUrl(url: string, origin = getBrowserOrigin()): boolean {
    try {
        const parsed = new URL(url, origin);
        return parsed.origin === origin && parsed.pathname.startsWith('/api/');
    } catch {
        return false;
    }
}

function isIgnoredApiPath(url: string, origin = getBrowserOrigin()): boolean {
    try {
        const parsed = new URL(url, origin);
        return IGNORED_API_PATHS.has(parsed.pathname);
    } catch {
        return false;
    }
}

function isSentryTransportUrl(url: string, origin = getBrowserOrigin()): boolean {
    const tunnelPath = getSentryTunnelPath();
    try {
        const parsed = new URL(url, origin);
        if (tunnelPath && parsed.origin === origin && parsed.pathname === tunnelPath) {
            return true;
        }
        const envelopeTarget = getSentryEnvelopeTarget();
        return Boolean(
            envelopeTarget &&
            parsed.origin === envelopeTarget.origin &&
            parsed.pathname.startsWith(envelopeTarget.pathnamePrefix),
        );
    } catch {
        return false;
    }
}

export function shouldCaptureFetchResponse(
    url: string,
    status: number,
    origin = getBrowserOrigin(),
): boolean {
    return (
        isInternalApiUrl(url, origin) &&
        !isIgnoredApiPath(url, origin) &&
        !isSentryTransportUrl(url, origin) &&
        status >= 500
    );
}

function shouldCaptureFetchException(url: string, origin = getBrowserOrigin()): boolean {
    return (
        isInternalApiUrl(url, origin) &&
        !isIgnoredApiPath(url, origin) &&
        !isSentryTransportUrl(url, origin)
    );
}

function buildTracePropagationTargets(origin: string): (string | RegExp)[] {
    return [
        'localhost',
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/api(\/|$)/,
        new RegExp(`^${escapeRegExp(origin)}/api(/|$)`),
    ];
}

function scrubBreadcrumbUrl(value: unknown): unknown {
    return typeof value === 'string' ? stripUrl(value) : value;
}

function beforeBreadcrumb(breadcrumb: any): any | null {
    const category = breadcrumb?.category;
    if (category !== 'fetch' && category !== 'xhr' && category !== 'navigation') {
        return breadcrumb;
    }

    const data = breadcrumb?.data && typeof breadcrumb.data === 'object'
        ? { ...breadcrumb.data }
        : undefined;

    const url = scrubBreadcrumbUrl(data?.url);
    if (typeof url === 'string' && (isIgnoredApiPath(url) || isSentryTransportUrl(url))) {
        return null;
    }

    if (data) {
        if ('url' in data) {
            data.url = url;
        }
        if ('from' in data) {
            data.from = scrubBreadcrumbUrl(data.from);
        }
        if ('to' in data) {
            data.to = scrubBreadcrumbUrl(data.to);
        }
    }

    return {
        ...breadcrumb,
        data,
    };
}

function beforeSend(event: any, hint?: any): any | null {
    if (!isFeatureEnabled('client_error_reporting')) {
        return null;
    }

    const originalException = hint?.originalException;
    if (originalException instanceof Error && shouldIgnoreError(originalException)) {
        return null;
    }

    const message = typeof event?.message === 'string' ? event.message : '';
    if (message && IGNORED_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
        return null;
    }

    if (event?.request?.url) {
        event.request = {
            ...event.request,
            url: stripUrl(event.request.url),
        };
    }

    event.tags = {
        ...event.tags,
        app_version: __APP_VERSION__,
    };

    return event;
}

function beforeSendTransaction(event: any): any | null {
    if (!isFeatureEnabled('client_metrics')) {
        return null;
    }

    if (typeof event?.transaction === 'string' && event.transaction === '/api/health') {
        return null;
    }

    return event;
}

function beforeAddReplayRecordingEvent(event: any): any | null {
    const description = event?.data?.payload?.description;
    if (typeof description !== 'string') {
        return event;
    }

    if (isIgnoredApiPath(description) || isSentryTransportUrl(description)) {
        return null;
    }

    return event;
}

function buildSentryIntegrations(): any[] {
    const integrations: any[] = [
        solidRouterBrowserTracingIntegration({
            traceFetch: true,
            traceXHR: true,
        }),
    ];

    const replayEnabled = parseBooleanFlag(import.meta.env.VITE_SENTRY_ENABLE_REPLAY, false);
    if (replayEnabled) {
        integrations.push(Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
            beforeAddRecordingEvent: beforeAddReplayRecordingEvent,
        }));
    }

    if (__SENTRY_APPLICATION_KEY_ENABLED__) {
        integrations.push(Sentry.thirdPartyErrorFilterIntegration({
            filterKeys: [THIRD_PARTY_APPLICATION_KEY],
            behaviour: 'drop-error-if-exclusively-contains-third-party-frames',
        }));
    }

    return integrations;
}

function installFetchDiagnostics(): void {
    if (fetchInstrumentationInstalled || typeof window === 'undefined' || typeof window.fetch !== 'function') {
        return;
    }

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const requestUrl = resolveRequestUrl(input);
        const requestMethod = resolveRequestMethod(input, init);

        try {
            const response = await originalFetch(input, init);

            if (shouldCaptureFetchResponse(requestUrl, response.status)) {
                const error = new Error(`API request failed (${response.status})`);
                void import('./errorReporting')
                    .then(({ reportError }) => reportError(error, {
                        request_method: requestMethod,
                        request_url: stripUrl(requestUrl),
                        response_status: response.status,
                        response_status_text: response.statusText,
                    }, {
                        fingerprint: ['api-response-error', requestMethod, stripUrl(requestUrl), String(response.status)],
                        tags: {
                            error_source: 'api_response',
                        },
                    }))
                    .catch(() => {});
            }

            return response;
        } catch (error) {
            if (error instanceof Error && shouldCaptureFetchException(requestUrl)) {
                void import('./errorReporting')
                    .then(({ reportError }) => reportError(error, {
                        request_method: requestMethod,
                        request_url: stripUrl(requestUrl),
                        error_source: 'api_network',
                    }, {
                        fingerprint: ['api-network-error', requestMethod, stripUrl(requestUrl)],
                        tags: {
                            error_source: 'api_network',
                        },
                    }))
                    .catch(() => {});
            }
            throw error;
        }
    };

    fetchInstrumentationInstalled = true;
}

export function shouldIgnoreError(error: Error): boolean {
    const message = `${error.name}: ${error.message}`;
    return IGNORED_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function initSentry(): void {
    if (sentryInitialized || typeof window === 'undefined') {
        return;
    }

    const dsn = resolveSentryDsn();
    if (!dsn) {
        return;
    }

    Sentry.init({
        dsn,
        environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
        tunnel: import.meta.env.VITE_SENTRY_TUNNEL || undefined,
        enabled: true,
        debug: parseBooleanFlag(import.meta.env.VITE_SENTRY_DEBUG, false),
        sendDefaultPii: parseBooleanFlag(import.meta.env.VITE_SENTRY_SEND_DEFAULT_PII, false),
        integrations: buildSentryIntegrations(),
        tracesSampleRate: parseSampleRate(
            import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
            DEFAULT_TRACES_SAMPLE_RATE,
        ),
        replaysSessionSampleRate: parseSampleRate(
            import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
            DEFAULT_REPLAYS_SESSION_SAMPLE_RATE,
        ),
        replaysOnErrorSampleRate: parseSampleRate(
            import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
            DEFAULT_REPLAYS_ON_ERROR_SAMPLE_RATE,
        ),
        tracePropagationTargets: buildTracePropagationTargets(window.location.origin),
        ignoreErrors: IGNORED_ERROR_PATTERNS,
        denyUrls: [
            /^chrome-extension:\/\//i,
            /^moz-extension:\/\//i,
            /^safari-extension:\/\//i,
        ],
        beforeSend,
        beforeSendTransaction,
        beforeBreadcrumb,
        initialScope: {
            tags: {
                app_version: __APP_VERSION__,
                ui_surface: 'unknown',
            },
        },
    });

    sentryInitialized = true;
    syncSentryRouteContext(window.location.pathname, false);
    installFetchDiagnostics();
}

export function captureHandledError(
    error: Error,
    context: Record<string, unknown> = {},
    options: HandledErrorOptions = {},
): void {
    if (!sentryInitialized || shouldIgnoreError(error)) {
        return;
    }

    Sentry.withScope((scope) => {
        scope.setLevel(options.level ?? 'error');

        if (options.fingerprint) {
            scope.setFingerprint(options.fingerprint);
        }

        for (const [key, value] of Object.entries(options.tags ?? {})) {
            scope.setTag(key, value);
        }

        const sanitizedContext = sanitizeContext(context);
        if (Object.keys(sanitizedContext).length > 0) {
            scope.setContext('app_error', sanitizedContext);
        }

        Sentry.captureException(error);
    });
}

export function syncSentryUser(user: AuthUserContext): void {
    if (!sentryInitialized) {
        return;
    }

    if (!user) {
        Sentry.setUser(null);
        return;
    }

    Sentry.setUser({
        id: user.id != null ? String(user.id) : undefined,
        username: user.username,
        email: user.email,
    });

    Sentry.setContext('viewer', {
        username: user.username,
        display_name: user.display_name,
    });
}

export function syncSentryRouteContext(pathname: string, isPublicRoute: boolean): void {
    if (!sentryInitialized) {
        return;
    }

    const repoContext = getCurrentRepoContext(pathname);

    Sentry.setTag('ui_surface', isPublicRoute ? 'public' : 'workbench');
    Sentry.setContext('route', {
        pathname: stripUrl(pathname),
    });

    if (repoContext.owner || repoContext.repo) {
        Sentry.setContext('repo', repoContext);
    } else {
        Sentry.setContext('repo', null);
    }
}
