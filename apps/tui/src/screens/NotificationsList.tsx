import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, List, Spinner, StatusBar, ErrorBox, EmptyState, type ListItem } from "../primitives";
import { formatTimeAgo, theme } from "../utils";

export interface NotificationsListProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

interface Notification {
  id: string;
  subject: {
    type: "issue" | "landing_request" | "change" | "repo";
    title: string;
    url: string;
  };
  repo: {
    owner: string;
    name: string;
    full_name: string;
  };
  reason: string;
  unread: boolean;
  updated_at: string;
}

function subjectIcon(type: string): string {
  switch (type) {
    case "issue": return "#";
    case "landing_request": return "!";
    case "change": return "~";
    case "repo": return "@";
    default: return "*";
  }
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case "assign": return "assigned";
    case "mention": return "mentioned";
    case "review_requested": return "review requested";
    case "state_change": return "state change";
    case "comment": return "comment";
    case "subscribed": return "subscribed";
    default: return reason;
  }
}

type FilterMode = "unread" | "all";

export function NotificationsList({ onNavigate }: NotificationsListProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filter, setFilter] = useState<FilterMode>("unread");
  const [markingAll, setMarkingAll] = useState(false);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { apiFetch } = await import("@jjhub/ui-core");
      const response = await apiFetch("/notifications?per_page=50");
      if (!response.ok) {
        throw new Error(`Failed to load notifications (${response.status})`);
      }
      const data = (await response.json()) as Notification[];
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Mark single notification as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      const { apiFetch } = await import("@jjhub/ui-core");
      await apiFetch(`/notifications/threads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, unread: false } : n)),
      );
    } catch {
      // Silently fail for mark-as-read
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    setMarkingAll(true);
    try {
      const { apiFetch } = await import("@jjhub/ui-core");
      await apiFetch("/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    } catch {
      // Silently fail
    } finally {
      setMarkingAll(false);
    }
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return notifications;
    return notifications.filter((n) => n.unread);
  }, [notifications, filter]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.unread).length,
    [notifications],
  );

  const items: ListItem[] = useMemo(
    () =>
      filtered.map((n) => ({
        key: n.id,
        label: `${subjectIcon(n.subject.type)} ${n.subject.title}`,
        description: `${n.repo.full_name} - ${reasonLabel(n.reason)} ${formatTimeAgo(n.updated_at)}`,
        badge: n.unread
          ? { text: "unread", color: theme.info }
          : { text: "read", color: theme.muted },
      })),
    [filtered],
  );

  // Handle keybindings
  useInput((input) => {
    if (input === "u") setFilter("unread");
    if (input === "A") setFilter("all");
    if (input === "a") markAllAsRead();
    if (input === "r") fetchNotifications();
  });

  const handleSelect = useCallback(
    (item: ListItem) => {
      const notification = filtered.find((n) => n.id === item.key);
      if (!notification) return;

      if (notification.unread) {
        markAsRead(notification.id);
      }

      const { repo, subject } = notification;
      switch (subject.type) {
        case "issue": {
          const issueMatch = subject.url.match(/\/issues\/(\d+)/);
          if (issueMatch) {
            onNavigate("issue-detail", {
              owner: repo.owner,
              name: repo.name,
              issueId: issueMatch[1]!,
            });
          }
          break;
        }
        case "landing_request": {
          const lrMatch = subject.url.match(/\/landings\/(\d+)/);
          if (lrMatch) {
            onNavigate("landing-detail", {
              owner: repo.owner,
              name: repo.name,
              lrId: lrMatch[1]!,
            });
          }
          break;
        }
        case "repo":
          onNavigate("repo", { owner: repo.owner, name: repo.name });
          break;
        default:
          onNavigate("repo", { owner: repo.owner, name: repo.name });
      }
    },
    [filtered, markAsRead, onNavigate],
  );

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} gap={2}>
        <Heading>Notifications</Heading>
        <Box gap={1}>
          {(["unread", "all"] as const).map((f) => (
            <Text
              key={f}
              bold={filter === f}
              color={filter === f ? theme.accent : theme.muted}
            >
              [{f}]
            </Text>
          ))}
        </Box>
        {unreadCount > 0 && (
          <Text color={theme.info} bold>
            {unreadCount} unread
          </Text>
        )}
        {markingAll && <Spinner label="Marking all as read..." />}
      </Box>

      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {loading ? (
          <Spinner label="Loading notifications..." />
        ) : error ? (
          <ErrorBox message={error.message} hint="Press r to refresh or q to go back." />
        ) : items.length === 0 ? (
          <EmptyState
            message={filter === "unread" ? "No unread notifications." : "No notifications."}
            hint={filter === "unread" ? "Press 'A' to view all notifications." : "You're all caught up!"}
          />
        ) : (
          <List items={items} onSelect={handleSelect} />
        )}
      </Box>

      <StatusBar
        bindings={[
          { key: "j/k", label: "navigate" },
          { key: "Enter", label: "open" },
          { key: "a", label: "mark all read" },
          { key: "u", label: "unread" },
          { key: "A", label: "all" },
          { key: "r", label: "refresh" },
          { key: "q", label: "back" },
        ]}
        left={`${filtered.length} notifications`}
      />
    </Box>
  );
}
