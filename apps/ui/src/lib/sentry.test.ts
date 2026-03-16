import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/solid', () => ({
    init: vi.fn(),
    replayIntegration: vi.fn(() => ({ name: 'Replay' })),
    thirdPartyErrorFilterIntegration: vi.fn(() => ({ name: 'ThirdPartyErrorsFilter' })),
    withScope: vi.fn(),
    captureException: vi.fn(),
    setUser: vi.fn(),
    setContext: vi.fn(),
    setTag: vi.fn(),
}));

vi.mock('@sentry/solid/solidrouter', () => ({
    solidRouterBrowserTracingIntegration: vi.fn(() => ({ name: 'BrowserTracing' })),
}));

let sentryHelpers: typeof import('./sentry');

beforeAll(async () => {
    sentryHelpers = await import('./sentry');
});

describe('sentry helpers', () => {
    it('falls back for invalid sample rates', () => {
        expect(sentryHelpers.parseSampleRate(undefined, 0.2)).toBe(0.2);
        expect(sentryHelpers.parseSampleRate('2', 0.2)).toBe(0.2);
        expect(sentryHelpers.parseSampleRate('-1', 0.2)).toBe(0.2);
        expect(sentryHelpers.parseSampleRate('0.5', 0.2)).toBe(0.5);
    });

    it('normalizes urls for safe reporting', () => {
        expect(sentryHelpers.stripUrl('/api/repos/foo/bar?token=secret#hash')).toBe('/api/repos/foo/bar');
        expect(sentryHelpers.stripUrl('https://example.com/a/b?x=1')).toBe('https://example.com/a/b');
    });

    it('detects internal api urls from relative or absolute inputs', () => {
        expect(sentryHelpers.isInternalApiUrl('/api/repos/foo/bar', 'http://localhost:3000')).toBe(true);
        expect(sentryHelpers.isInternalApiUrl('http://localhost:3000/api/repos/foo/bar', 'http://localhost:3000')).toBe(true);
        expect(sentryHelpers.isInternalApiUrl('https://example.com/api/repos/foo/bar', 'http://localhost:3000')).toBe(false);
    });

    it('captures only server-side api failures', () => {
        expect(sentryHelpers.shouldCaptureFetchResponse('/api/repos/foo/bar', 500, 'http://localhost:3000')).toBe(true);
        expect(sentryHelpers.shouldCaptureFetchResponse('/api/repos/foo/bar', 404, 'http://localhost:3000')).toBe(false);
        expect(sentryHelpers.shouldCaptureFetchResponse('/api/health', 500, 'http://localhost:3000')).toBe(false);
        expect(sentryHelpers.shouldCaptureFetchResponse('https://example.com/api/repos/foo/bar', 500, 'http://localhost:3000')).toBe(false);
    });

    it('resolves relative request urls against the current origin', () => {
        expect(sentryHelpers.resolveRequestUrl('/api/repos/foo/bar')).toBe(`${window.location.origin}/api/repos/foo/bar`);
    });
});
