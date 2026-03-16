// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAuthenticatedEventSource } from './authenticatedEventSource';

function sseResponse(...chunks: string[]): Response {
    const encoder = new TextEncoder();
    return new Response(new ReadableStream<Uint8Array>({
        start(controller) {
            for (const chunk of chunks) {
                controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
        },
    }), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
    });
}

function failingSseResponse(...chunks: string[]): Response {
    const encoder = new TextEncoder();
    return new Response(new ReadableStream<Uint8Array>({
        start(controller) {
            for (const chunk of chunks) {
                controller.enqueue(encoder.encode(chunk));
            }
            controller.error(new Error('connection dropped'));
        },
    }), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
    });
}

describe('createAuthenticatedEventSource', () => {
    afterEach(() => {
        window.localStorage.clear();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('exchanges a stored token for an SSE ticket and keeps the PAT out of the stream URL', async () => {
        const rawToken = 'jjhub_0123456789abcdef0123456789abcdef01234567';
        window.localStorage.setItem('jjhub_token', rawToken);

        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ ticket: 'jwt-ticket-value' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }))
            .mockResolvedValueOnce(sseResponse(
                'id: 1\n',
                'event: notification\n',
                'data: {"id":1}\n\n',
            ));
        vi.stubGlobal('fetch', fetchMock);

        await new Promise<void>((resolve) => {
            const client = createAuthenticatedEventSource('/api/notifications');
            client.addEventListener('notification', (event) => {
                expect(JSON.parse(event.data)).toEqual({ id: 1 });
                client.close();
                resolve();
            });
        });

        expect(fetchMock).toHaveBeenCalledTimes(2);

        const [ticketURL, ticketInit] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(ticketURL).toBe('/api/v1/sse/ticket');
        expect(new Headers(ticketInit.headers).get('Authorization')).toBe(`token ${rawToken}`);

        const [streamURL, streamInit] = fetchMock.mock.calls[1] as [string, RequestInit];
        expect(streamURL).toContain('ticket=jwt-ticket-value');
        expect(streamURL).not.toContain(rawToken);
        expect(new Headers(streamInit.headers).get('Authorization')).toBeNull();
    });

    it('uses an explicit Authorization header for ticket exchange when localStorage is empty', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ ticket: 'jwt-ticket-value' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }))
            .mockResolvedValueOnce(sseResponse(
                'event: notification\n',
                'data: {"id":2}\n\n',
            ));
        vi.stubGlobal('fetch', fetchMock);

        await new Promise<void>((resolve) => {
            const client = createAuthenticatedEventSource('/api/notifications', {
                headers: {
                    Authorization: 'token jjhub_explicit_token',
                },
            });
            client.addEventListener('notification', () => {
                client.close();
                resolve();
            });
        });

        const [, ticketInit] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(new Headers(ticketInit.headers).get('Authorization')).toBe('token jjhub_explicit_token');

        const [, streamInit] = fetchMock.mock.calls[1] as [string, RequestInit];
        expect(new Headers(streamInit.headers).get('Authorization')).toBeNull();
    });

    it('exchanges tickets against the stream origin for absolute SSE URLs', async () => {
        const rawToken = 'jjhub_0123456789abcdef0123456789abcdef01234567';
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ ticket: 'jwt-ticket-value' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }))
            .mockResolvedValueOnce(sseResponse(
                'event: notification\n',
                'data: {"id":4}\n\n',
            ));
        vi.stubGlobal('fetch', fetchMock);

        await new Promise<void>((resolve) => {
            const client = createAuthenticatedEventSource('https://api.example.test/api/notifications', {
                headers: {
                    Authorization: rawToken,
                },
            });
            client.addEventListener('notification', () => {
                client.close();
                resolve();
            });
        });

        const [ticketURL] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(ticketURL).toBe('https://api.example.test/api/v1/sse/ticket');

        const [streamURL] = fetchMock.mock.calls[1] as [string, RequestInit];
        expect(streamURL).toContain('ticket=jwt-ticket-value');
        expect(streamURL).not.toContain(rawToken);
    });

    it('normalizes a raw PAT from an explicit Authorization header before ticket exchange', async () => {
        const rawToken = 'jjhub_0123456789abcdef0123456789abcdef01234567';
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ ticket: 'jwt-ticket-value' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }))
            .mockResolvedValueOnce(sseResponse(
                'event: notification\n',
                'data: {"id":3}\n\n',
            ));
        vi.stubGlobal('fetch', fetchMock);

        await new Promise<void>((resolve) => {
            const client = createAuthenticatedEventSource('/api/notifications', {
                headers: {
                    Authorization: rawToken,
                },
            });
            client.addEventListener('notification', () => {
                client.close();
                resolve();
            });
        });

        const [, ticketInit] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(new Headers(ticketInit.headers).get('Authorization')).toBe(`token ${rawToken}`);
    });

    it('does not dispatch empty events when the stream only advances Last-Event-ID', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ ticket: 'jwt-ticket-value' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }))
            .mockResolvedValueOnce(sseResponse(
                'id: 4\n\n',
                'id: 5\n',
                'event: notification\n',
                'data: {"id":5}\n\n',
            ));
        vi.stubGlobal('fetch', fetchMock);

        const messageEvents: string[] = [];
        let notificationLastEventId = '';
        await new Promise<void>((resolve) => {
            const client = createAuthenticatedEventSource('/api/notifications', {
                headers: {
                    Authorization: 'token jjhub_explicit_token',
                },
            });
            client.addEventListener('message', (event) => {
                messageEvents.push(event.data);
            });
            client.addEventListener('notification', (event) => {
                notificationLastEventId = event.lastEventId;
                client.close();
                resolve();
            });
        });

        expect(messageEvents).toEqual(['{"id":5}']);
        expect(notificationLastEventId).toBe('5');
    });

    it('clears Last-Event-ID on reconnect when the stream sends an empty id field', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ ticket: 'ticket-1' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }))
            .mockResolvedValueOnce(sseResponse(
                'id: 5\n',
                'data: {"phase":1}\n\n',
            ))
            .mockResolvedValueOnce(new Response(JSON.stringify({ ticket: 'ticket-2' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }))
            .mockResolvedValueOnce(sseResponse(
                'id:\n\n',
            ))
            .mockResolvedValueOnce(new Response(JSON.stringify({ ticket: 'ticket-3' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }))
            .mockResolvedValueOnce(sseResponse(
                'event: notification\n',
                'data: {"done":true}\n\n',
            ));
        vi.stubGlobal('fetch', fetchMock);

        await new Promise<void>((resolve) => {
            const client = createAuthenticatedEventSource('/api/notifications', {
                headers: {
                    Authorization: 'token jjhub_explicit_token',
                },
            });
            client.addEventListener('notification', () => {
                client.close();
                resolve();
            });
        });

        const [, firstStreamInit] = fetchMock.mock.calls[1] as [string, RequestInit];
        expect(new Headers(firstStreamInit.headers).get('Last-Event-ID')).toBeNull();

        const [, secondStreamInit] = fetchMock.mock.calls[3] as [string, RequestInit];
        expect(new Headers(secondStreamInit.headers).get('Last-Event-ID')).toBe('5');

        const [, thirdStreamInit] = fetchMock.mock.calls[5] as [string, RequestInit];
        expect(new Headers(thirdStreamInit.headers).get('Last-Event-ID')).toBeNull();
    });

    it('does not carry partial event state across reconnects after a stream read error', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ ticket: 'ticket-1' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }))
            .mockResolvedValueOnce(failingSseResponse(
                'event: notification\n',
                'data: {"partial":true}',
            ))
            .mockResolvedValueOnce(new Response(JSON.stringify({ ticket: 'ticket-2' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }))
            .mockResolvedValueOnce(sseResponse(
                'event: notification\n',
                'data: {"id":6}\n\n',
            ));
        vi.stubGlobal('fetch', fetchMock);

        const notificationPayloads: string[] = [];
        await new Promise<void>((resolve) => {
            const client = createAuthenticatedEventSource('/api/notifications', {
                headers: {
                    Authorization: 'token jjhub_explicit_token',
                },
            });
            client.onerror = () => {
                // Expected once for the simulated reconnect.
            };
            client.addEventListener('notification', (event) => {
                notificationPayloads.push(event.data);
                client.close();
                resolve();
            });
        });

        expect(notificationPayloads).toEqual(['{"id":6}']);
    });
});
