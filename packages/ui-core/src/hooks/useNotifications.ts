import { createResource, createMemo } from "solid-js";
import { apiFetch } from "../api/client";
import type { Notification, NotificationsPage } from "../api/types";

export type UseNotificationsResult = {
    notifications: () => Notification[] | undefined;
    unread: () => number;
    loading: () => boolean;
    error: () => Error | undefined;
    refetch: () => void;
};

async function fetchNotifications(): Promise<NotificationsPage> {
    const response = await apiFetch("/api/notifications/list?page=1&per_page=30");
    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || `Failed to fetch notifications (${response.status})`);
    }

    const total = parseInt(response.headers.get("X-Total-Count") || "0", 10);
    const items = (await response.json()) as Notification[];
    return {
        total,
        items: Array.isArray(items) ? items : [],
    };
}

export function useNotifications(): UseNotificationsResult {
    const [data, { refetch }] = createResource(fetchNotifications);

    const unread = createMemo(() => {
        const items = data()?.items;
        if (!items) return 0;
        return items.filter((n) => n.read_at === null).length;
    });

    return {
        notifications: () => data()?.items,
        unread,
        loading: () => data.loading,
        error: () => data.error as Error | undefined,
        refetch,
    };
}
