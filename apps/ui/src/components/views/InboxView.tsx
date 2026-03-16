import { Bell, MessageSquare, Eye, GitMerge, Loader2, AlertCircle, Inbox, ChevronLeft, ChevronRight } from 'lucide-solid';
import { createSignal, onMount, onCleanup, Show, For, type Component } from 'solid-js';
import { apiFetch } from '../../lib/repoContext';
import { createAuthenticatedEventSource, type SSEClient } from '../../lib/authenticatedEventSource';
import {
    inboxNotificationsResource,
    type Notification,
} from '../../lib/navigationData';

const PER_PAGE = 30;

function iconForSourceType(sourceType: string): Component<{ size?: number; class?: string }> {
    switch (sourceType) {
        case 'mention':
            return MessageSquare;
        case 'review':
            return Eye;
        case 'landing_request':
            return GitMerge;
        default:
            return Bell;
    }
}

function colorForSourceType(sourceType: string): string {
    switch (sourceType) {
        case 'mention':
            return 'text-blue';
        case 'review':
            return 'text-purple';
        case 'landing_request':
            return 'text-green';
        default:
            return 'text-muted';
    }
}

function formatRelativeTime(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

export default function InboxView() {
    const initialPage = inboxNotificationsResource.peek(1);
    const [notifications, setNotifications] = createSignal<Notification[]>(initialPage?.items ?? []);
    const [loading, setLoading] = createSignal(initialPage === undefined);
    const [error, setError] = createSignal<string | null>(null);
    const [page, setPage] = createSignal(1);
    const [totalCount, setTotalCount] = createSignal(initialPage?.total ?? 0);

    let eventSource: SSEClient | null = null;

    const unreadCount = () => notifications().filter(n => n.status === 'unread').length;
    const totalPages = () => Math.max(1, Math.ceil(totalCount() / PER_PAGE));
    const hasPrev = () => page() > 1;
    const hasNext = () => page() < totalPages();

    async function fetchNotifications(pageNum: number) {
        const cachedPage = inboxNotificationsResource.peek(pageNum);
        if (cachedPage) {
            setNotifications(cachedPage.items);
            setTotalCount(cachedPage.total);
        }

        setLoading(!cachedPage);
        setError(null);
        try {
            const result = await inboxNotificationsResource.load(pageNum);
            setTotalCount(result.total);
            setNotifications(result.items);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load notifications');
        } finally {
            setLoading(false);
        }
    }

    async function markRead(notifId: number) {
        try {
            const res = await apiFetch(`/api/notifications/${notifId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'read' }),
            });
            if (res.ok) {
                setNotifications(prev =>
                    prev.map(n =>
                        n.id === notifId
                            ? { ...n, status: 'read', read_at: new Date().toISOString() }
                            : n
                    )
                );
            }
        } catch {
            // Best-effort: if mark-read fails, the notification stays unread
        }
    }

    async function markAllRead() {
        try {
            const res = await apiFetch('/api/notifications/mark-read', {
                method: 'PUT',
            });
            if (res.ok) {
                setNotifications(prev =>
                    prev.map(n => ({
                        ...n,
                        status: 'read',
                        read_at: n.read_at || new Date().toISOString(),
                    }))
                );
            }
        } catch {
            // Best-effort
        }
    }

    function connectSSE() {
        eventSource = createAuthenticatedEventSource('/api/notifications');

        eventSource.addEventListener('notification', (e: MessageEvent) => {
            try {
                const notif: Notification = JSON.parse(e.data);
                setNotifications(prev => {
                    // Avoid duplicates (in case of replay)
                    if (prev.some(n => n.id === notif.id)) {
                        return prev.map(n => n.id === notif.id ? notif : n);
                    }
                    return [notif, ...prev];
                });
                // Update total count when new notification arrives
                setTotalCount(c => c + 1);
            } catch {
                // Ignore malformed events
            }
        });

        eventSource.onerror = () => {
            // EventSource will auto-reconnect with Last-Event-ID
            // No manual intervention needed
        };
    }

    function goToPage(pageNum: number) {
        setPage(pageNum);
        fetchNotifications(pageNum);
    }

    onMount(() => {
        fetchNotifications(1);
        connectSSE();
    });

    onCleanup(() => {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
    });

    return (
        <div class="flex flex-col h-full w-full bg-app text-primary">
            <div class="p-6 border-b border-color flex items-center justify-between">
                <h1 class="text-xl font-semibold flex items-center gap-2">
                    Inbox
                    <Show when={!loading() && unreadCount() > 0}>
                        <span class="badge-count subtle">{unreadCount()} unread</span>
                    </Show>
                </h1>
                <Show when={!loading() && unreadCount() > 0}>
                    <button
                        class="text-sm text-muted hover:text-primary transition-colors"
                        onClick={markAllRead}
                    >
                        Mark all as read
                    </button>
                </Show>
            </div>

            <div class="flex-1 overflow-y-auto p-6">
                <div class="max-w-4xl mx-auto flex flex-col gap-3">
                    {/* Loading state */}
                    <Show when={loading()}>
                        <div class="flex items-center justify-center py-16 text-muted">
                            <Loader2 size={24} class="animate-spin mr-3" />
                            <span>Loading notifications...</span>
                        </div>
                    </Show>

                    {/* Error state */}
                    <Show when={!loading() && error()}>
                        <div class="flex flex-col items-center justify-center py-16 text-muted gap-3">
                            <AlertCircle size={32} class="text-red" />
                            <p class="text-sm">{error()}</p>
                            <button
                                class="text-sm text-blue hover:underline"
                                onClick={() => fetchNotifications(page())}
                            >
                                Try again
                            </button>
                        </div>
                    </Show>

                    {/* Empty state */}
                    <Show when={!loading() && !error() && notifications().length === 0}>
                        <div class="flex flex-col items-center justify-center py-16 text-muted gap-3">
                            <Inbox size={32} />
                            <p class="text-sm">No notifications yet</p>
                        </div>
                    </Show>

                    {/* Notification list */}
                    <Show when={!loading() && !error() && notifications().length > 0}>
                        <For each={notifications()}>
                            {(notification) => {
                                const isUnread = () => notification.status === 'unread';
                                const Icon = iconForSourceType(notification.source_type);
                                const iconColor = colorForSourceType(notification.source_type);
                                return (
                                    <div
                                        class={`p-4 rounded-xl border ${isUnread() ? 'border-color bg-panel shadow-sm' : 'border-color bg-root opacity-75'} flex items-start gap-4 transition-all hover:bg-panel-hover cursor-pointer`}
                                        onClick={() => {
                                            if (isUnread()) {
                                                markRead(notification.id);
                                            }
                                        }}
                                    >
                                        <div class="mt-1">
                                            <Icon size={20} class={iconColor} />
                                        </div>
                                        <div class="flex-1">
                                            <div class="flex justify-between items-start mb-1">
                                                <h3 class={`font-medium ${isUnread() ? 'text-primary' : 'text-muted'}`}>
                                                    {notification.subject}
                                                </h3>
                                                <span class="text-xs text-muted whitespace-nowrap ml-4">
                                                    {formatRelativeTime(notification.created_at)}
                                                </span>
                                            </div>
                                            <Show when={notification.body}>
                                                <p class="text-sm text-muted mb-0">{notification.body}</p>
                                            </Show>
                                        </div>
                                        <Show when={isUnread()}>
                                            <div class="w-2 h-2 rounded-full bg-blue self-center flex-shrink-0"></div>
                                        </Show>
                                    </div>
                                );
                            }}
                        </For>

                        {/* Pagination */}
                        <Show when={totalPages() > 1}>
                            <div class="flex items-center justify-center gap-4 pt-4 pb-2">
                                <button
                                    class="flex items-center gap-1 text-sm text-muted hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    disabled={!hasPrev()}
                                    onClick={() => goToPage(page() - 1)}
                                >
                                    <ChevronLeft size={16} />
                                    Previous
                                </button>
                                <span class="text-sm text-muted">
                                    Page {page()} of {totalPages()}
                                </span>
                                <button
                                    class="flex items-center gap-1 text-sm text-muted hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    disabled={!hasNext()}
                                    onClick={() => goToPage(page() + 1)}
                                >
                                    Next
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </Show>
                    </Show>
                </div>
            </div>
        </div>
    );
}
