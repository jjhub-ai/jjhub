/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SENTRY_DSN?: string;
    readonly VITE_SENTRY_ENVIRONMENT?: string;
    readonly VITE_SENTRY_ENABLE_REPLAY?: string;
    readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string;
    readonly VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE?: string;
    readonly VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE?: string;
    readonly VITE_SENTRY_TUNNEL?: string;
    readonly VITE_SENTRY_DEBUG?: string;
    readonly VITE_SENTRY_SEND_DEFAULT_PII?: string;
}

declare const __APP_VERSION__: string;
declare const __SENTRY_APPLICATION_KEY_ENABLED__: boolean;

declare module 'monaco-editor/esm/vs/editor/editor.all.js';
