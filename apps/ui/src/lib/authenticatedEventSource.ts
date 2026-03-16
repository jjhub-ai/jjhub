import { getStoredToken } from './repoContext';

export type SSEEventListener = (event: MessageEvent<string>) => void;

export interface SSEClient {
    addEventListener(type: string, listener: SSEEventListener): void;
    removeEventListener(type: string, listener: SSEEventListener): void;
    close(): void;
    onerror: ((error: unknown) => void) | null;
}

export interface AuthenticatedEventSourceInit extends Omit<RequestInit, 'credentials' | 'headers' | 'method' | 'body' | 'signal'> {
    headers?: HeadersInit;
    signal?: AbortSignal;
    withCredentials?: boolean;
}

const SSE_TICKET_PATH = '/api/v1/sse/ticket';
const INITIAL_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;

class SSEConnectionError extends Error {
    constructor(
        message: string,
        public readonly retryable: boolean,
    ) {
        super(message);
        this.name = 'SSEConnectionError';
    }
}

function toMessageEvent(url: string, type: string, data: string, lastEventId: string): MessageEvent<string> {
    return new MessageEvent<string>(type || 'message', {
        data,
        lastEventId,
        origin: typeof window === 'undefined' ? '' : new URL(url, window.location.origin).origin,
    });
}

function normalizeCredentials(withCredentials?: boolean): RequestCredentials {
    return withCredentials === false ? 'same-origin' : 'include';
}

function buildStreamURL(url: string, ticket: string | null): string {
    if (!ticket) {
        return url;
    }
    const resolved = resolveURL(url);
    resolved.searchParams.set('ticket', ticket);
    return url.startsWith('http://') || url.startsWith('https://')
        ? resolved.toString()
        : `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

function resolveURL(url: string): URL {
    const base = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
    return new URL(url, base);
}

function buildTicketURL(url: string): string {
    const resolved = resolveURL(url);
    const ticketURL = new URL(SSE_TICKET_PATH, resolved.origin);
    return url.startsWith('http://') || url.startsWith('https://')
        ? ticketURL.toString()
        : `${ticketURL.pathname}${ticketURL.search}${ticketURL.hash}`;
}

function streamHeaders(headers: HeadersInit | undefined, lastEventId: string): Headers {
    const merged = new Headers(headers ?? undefined);
    merged.delete('Authorization');
    merged.set('Accept', 'text/event-stream');
    if (lastEventId) {
        merged.set('Last-Event-ID', lastEventId);
    } else {
        merged.delete('Last-Event-ID');
    }
    return merged;
}

function normalizeAuthorizationValue(value: string): string {
    const trimmed = value.trim();
    if (/^(token|bearer)\s+/i.test(trimmed)) {
        return trimmed;
    }
    if (/^jjhub_(?:oat_)?[0-9a-f]+$/i.test(trimmed)) {
        return `token ${trimmed}`;
    }
    return trimmed;
}

function authTokenFromHeaders(headers: HeadersInit | undefined): string | null {
    const merged = new Headers(headers ?? undefined);
    const explicit = merged.get('Authorization')?.trim();
    if (explicit) {
        return normalizeAuthorizationValue(explicit);
    }
    return getStoredToken();
}

async function fetchSSETicket(url: string, token: string, credentials: RequestCredentials, signal: AbortSignal): Promise<string> {
    const response = await fetch(buildTicketURL(url), {
        method: 'POST',
        credentials,
        signal,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': token,
        },
        body: '{}',
    });

    if (!response.ok) {
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        throw new SSEConnectionError(`Failed to create SSE ticket (${response.status})`, retryable);
    }

    const body = await response.json().catch(() => null) as { ticket?: unknown } | null;
    const ticket = typeof body?.ticket === 'string' ? body.ticket.trim() : '';
    if (!ticket) {
        throw new SSEConnectionError('SSE ticket response missing ticket', false);
    }
    return ticket;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = globalThis.setTimeout(() => {
            cleanup();
            resolve();
        }, ms);

        const onAbort = () => {
            cleanup();
            reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
        };

        const cleanup = () => {
            globalThis.clearTimeout(timer);
            signal.removeEventListener('abort', onAbort);
        };

        signal.addEventListener('abort', onAbort, { once: true });
    });
}

class FetchSSEClient implements SSEClient {
    public onerror: ((error: unknown) => void) | null = null;

    private readonly target = new EventTarget();
    private readonly abortController = new AbortController();
    private readonly signal: AbortSignal;
    private closed = false;
    private lastEventId = '';
    private pendingType = '';
    private pendingData: string[] = [];
    private pendingEventId = '';
    private pendingEventIdSet = false;
    private retryDelayMs = INITIAL_RETRY_DELAY_MS;

    constructor(
        private readonly url: string,
        init: AuthenticatedEventSourceInit = {},
    ) {
        const externalSignal = init.signal;
        if (externalSignal) {
            if (externalSignal.aborted) {
                this.abortController.abort(externalSignal.reason);
            } else {
                externalSignal.addEventListener('abort', () => this.close(), { once: true });
            }
        }

        this.signal = this.abortController.signal;
        void this.connectLoop(init);
    }

    addEventListener(type: string, listener: SSEEventListener): void {
        this.target.addEventListener(type, listener as EventListener);
    }

    removeEventListener(type: string, listener: SSEEventListener): void {
        this.target.removeEventListener(type, listener as EventListener);
    }

    close(): void {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this.abortController.abort();
    }

    private dispatch(type: string, event: MessageEvent<string>): void {
        this.target.dispatchEvent(event);
        if (type !== 'message') {
            this.target.dispatchEvent(new MessageEvent<string>('message', {
                data: event.data,
                lastEventId: event.lastEventId,
                origin: event.origin,
            }));
        }
    }

    private async connectLoop(init: AuthenticatedEventSourceInit): Promise<void> {
        const credentials = normalizeCredentials(init.withCredentials);

        while (!this.closed) {
            try {
                await this.openStream(init, credentials);
                this.retryDelayMs = INITIAL_RETRY_DELAY_MS;
                if (!this.closed) {
                    throw new SSEConnectionError('SSE stream ended', true);
                }
            } catch (error) {
                if (this.closed || this.signal.aborted) {
                    return;
                }

                this.onerror?.(error);

                const retryable = error instanceof SSEConnectionError ? error.retryable : true;
                if (!retryable) {
                    return;
                }

                try {
                    await delay(this.retryDelayMs, this.signal);
                } catch {
                    return;
                }
                this.retryDelayMs = Math.min(this.retryDelayMs * 2, MAX_RETRY_DELAY_MS);
            }
        }
    }

    private async openStream(init: AuthenticatedEventSourceInit, credentials: RequestCredentials): Promise<void> {
        const { headers, signal: _signal, withCredentials: _withCredentials, ...requestInit } = init;
        const authToken = authTokenFromHeaders(headers);
        const ticket = authToken ? await fetchSSETicket(this.url, authToken, credentials, this.signal) : null;
        const response = await fetch(buildStreamURL(this.url, ticket), {
            ...requestInit,
            method: 'GET',
            credentials,
            headers: streamHeaders(headers, this.lastEventId),
            signal: this.signal,
        });

        if (!response.ok) {
            const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
            throw new SSEConnectionError(`SSE request failed (${response.status})`, retryable);
        }

        if (!response.body) {
            throw new SSEConnectionError('SSE response body missing', true);
        }

        this.retryDelayMs = INITIAL_RETRY_DELAY_MS;
        await this.readStream(response.body);
    }

    private async readStream(body: ReadableStream<Uint8Array>): Promise<void> {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (!this.closed) {
                const { value, done } = await reader.read();
                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                buffer = this.processBuffer(buffer);
            }

            buffer += decoder.decode();
            buffer = this.processBuffer(buffer);
            if (buffer.length > 0) {
                this.processLine(buffer.replace(/\r$/, ''));
            }
            this.flushEvent();
        } catch (error) {
            this.resetPendingEvent();
            throw error;
        } finally {
            reader.releaseLock();
        }
    }

    private processBuffer(buffer: string): string {
        let remaining = buffer;
        while (true) {
            const newlineIndex = remaining.indexOf('\n');
            if (newlineIndex === -1) {
                return remaining;
            }

            const rawLine = remaining.slice(0, newlineIndex);
            remaining = remaining.slice(newlineIndex + 1);
            this.processLine(rawLine.replace(/\r$/, ''));
        }
    }

    private processLine(line: string): void {
        if (line === '') {
            this.flushEvent();
            return;
        }

        if (line.startsWith(':')) {
            return;
        }

        const separator = line.indexOf(':');
        const field = separator === -1 ? line : line.slice(0, separator);
        let value = separator === -1 ? '' : line.slice(separator + 1);
        if (value.startsWith(' ')) {
            value = value.slice(1);
        }

        switch (field) {
            case 'event':
                this.pendingType = value;
                break;
            case 'data':
                this.pendingData.push(value);
                break;
            case 'id':
                this.pendingEventId = value;
                this.pendingEventIdSet = true;
                break;
            default:
                break;
        }
    }

    private flushEvent(): void {
        if (this.pendingData.length === 0 && this.pendingType === '' && !this.pendingEventIdSet) {
            return;
        }

        if (this.pendingEventIdSet) {
            this.lastEventId = this.pendingEventId;
        }

        if (this.pendingData.length === 0) {
            this.resetPendingEvent();
            return;
        }

        const eventId = this.pendingEventId || this.lastEventId;
        const event = toMessageEvent(this.url, this.pendingType || 'message', this.pendingData.join('\n'), eventId);
        this.dispatch(this.pendingType || 'message', event);

        this.resetPendingEvent();
    }

    private resetPendingEvent(): void {
        this.pendingType = '';
        this.pendingData = [];
        this.pendingEventId = '';
        this.pendingEventIdSet = false;
    }
}

export function createAuthenticatedEventSource(url: string, init?: AuthenticatedEventSourceInit): SSEClient {
    return new FetchSSEClient(url, init);
}
