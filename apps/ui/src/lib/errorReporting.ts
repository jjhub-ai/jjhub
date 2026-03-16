import { isFeatureEnabled } from './featureFlags';
import { captureHandledError, shouldIgnoreError } from './sentry';

const API_BASE = '/api';

declare const __APP_VERSION__: string;

type ReportErrorOptions = {
    captureInSentry?: boolean;
    captureInTelemetry?: boolean;
    fingerprint?: string[];
    level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
    tags?: Record<string, string>;
};

function buildResourceLoadError(target: EventTarget | null): Error | null {
    if (!(target instanceof HTMLElement)) {
        return null;
    }

    const url =
        target instanceof HTMLScriptElement ? target.src :
        target instanceof HTMLLinkElement ? target.href :
        target instanceof HTMLImageElement ? target.currentSrc || target.src :
        '';

    if (!url) {
        return null;
    }

    return new Error(`Resource failed to load: ${url}`);
}

export async function reportError(
    error: Error,
    context: Record<string, unknown> = {},
    options: ReportErrorOptions = {},
) {
    if (!isFeatureEnabled('client_error_reporting')) {
        return;
    }

    if (shouldIgnoreError(error)) {
        return;
    }

    if (options.captureInSentry !== false) {
        captureHandledError(error, context, {
            fingerprint: options.fingerprint,
            level: options.level,
            tags: options.tags,
        });
    }

    if (options.captureInTelemetry === false) {
        return;
    }

    try {
        await fetch(`${API_BASE}/telemetry/errors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client: 'web',
                version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown',
                error: {
                    message: error.message?.slice(0, 512) ?? 'Unknown error',
                    stack: error.stack?.slice(0, 4096) ?? '',
                    type: error.name ?? 'Error',
                },
                context: {
                    url: window.location.pathname,
                    user_agent: navigator.userAgent,
                    ...context,
                },
            }),
        });
    } catch {
        // Never throw from error reporting
    }
}

export function initGlobalErrorHandlers() {
    if (typeof window === 'undefined') {
        return;
    }

    window.addEventListener('error', (event) => {
        if (event.error instanceof Error) {
            void reportError(event.error, {
                source: event.filename,
                lineno: event.lineno,
                colno: event.colno,
            }, {
                captureInSentry: false,
            });
            return;
        }

        const resourceError = buildResourceLoadError(event.target);
        if (resourceError) {
            void reportError(resourceError, {
                source: event.filename,
                resource: 'asset_load',
            }, {
                captureInSentry: false,
                fingerprint: ['asset-load-failure'],
            });
        }
    });

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
        const error = event.reason instanceof Error
            ? event.reason
            : new Error(String(event.reason));
        void reportError(error, { type: 'unhandled_rejection' }, { captureInSentry: false });
    });
}
