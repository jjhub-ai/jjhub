import React, { useMemo } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, List, Spinner, StatusBar, type ListItem } from "../primitives";
import { useAgentSessions } from "../hooks";

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function statusColor(status: string): string {
  switch (status) {
    case "running":
    case "started":
      return "green";
    case "completed":
      return "cyan";
    case "failed":
      return "red";
    case "cancelled":
      return "gray";
    default:
      return "yellow";
  }
}

export interface AgentSessionListProps {
  owner: string;
  name: string;
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function AgentSessionList({ owner, name, onNavigate }: AgentSessionListProps) {
  const { sessions, loading, error, refetch, deleteSession } = useAgentSessions({
    owner,
    repo: name,
  });

  const items: ListItem[] = useMemo(() => {
    if (!sessions) return [];
    return sessions.map((session) => ({
      key: session.id,
      label: session.title || `Session ${session.id.slice(0, 8)}`,
      description: formatTimeAgo(session.created_at),
      badge: { text: session.status, color: statusColor(session.status) },
    }));
  }, [sessions]);

  useInput((input) => {
    if (input === "n") {
      onNavigate("agent-chat", { owner, name, mode: "new" });
    }
    if (input === "r") {
      refetch();
    }
    if (input === "d" && sessions && sessions.length > 0) {
      // Delete is handled via the list's selected item, but we need the index.
      // For simplicity, we just provide the keybinding hint — deletion happens
      // in the onDelete flow below. We use a separate state approach.
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} gap={2}>
        <Heading>
          Agent Sessions - {owner}/{name}
        </Heading>
      </Box>

      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
        {loading ? (
          <Spinner label="Loading agent sessions..." />
        ) : error ? (
          <Text color="red">Error: {error.message}</Text>
        ) : items.length === 0 ? (
          <Box flexDirection="column" gap={1}>
            <Text dimColor>No agent sessions yet.</Text>
            <Text dimColor>
              Press <Text color="yellow" bold>n</Text> to start a new session.
            </Text>
          </Box>
        ) : (
          <AgentSessionListView
            items={items}
            sessions={sessions ?? []}
            onSelect={(item) => {
              onNavigate("agent-chat", {
                owner,
                name,
                sessionId: item.key,
              });
            }}
            onDelete={async (item) => {
              await deleteSession(item.key);
            }}
          />
        )}
      </Box>

      <StatusBar
        bindings={[
          { key: "j/k", label: "navigate" },
          { key: "Enter", label: "open" },
          { key: "n", label: "new session" },
          { key: "d", label: "delete" },
          { key: "r", label: "refresh" },
          { key: "q", label: "back" },
        ]}
        left={sessions ? `${sessions.length} sessions` : undefined}
      />
    </Box>
  );
}

/** Inner component that wraps List with delete support. */
function AgentSessionListView({
  items,
  sessions,
  onSelect,
  onDelete,
}: {
  items: ListItem[];
  sessions: { id: string }[];
  onSelect: (item: ListItem) => void;
  onDelete: (item: ListItem) => void;
}) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  useInput((input) => {
    if (input === "d" && items.length > 0) {
      const item = items[selectedIndex];
      if (item) onDelete(item);
    }
  });

  return (
    <List
      items={items}
      onSelect={onSelect}
      onHighlight={(_item, index) => setSelectedIndex(index)}
    />
  );
}
