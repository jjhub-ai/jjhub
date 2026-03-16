import React, { useMemo } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, List, Spinner, StatusBar, ErrorBox, EmptyState, type ListItem } from "../primitives";
import { useAgentSessions } from "../hooks";
import { formatTimeAgo, statusColor, theme } from "../utils";

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
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} gap={2}>
        <Heading>Agent Sessions</Heading>
      </Box>

      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
        {loading ? (
          <Spinner label="Loading agent sessions..." />
        ) : error ? (
          <ErrorBox message={error.message} hint="Press q to go back." />
        ) : items.length === 0 ? (
          <EmptyState
            message="No agent sessions yet."
            hint="Press 'n' to start a new session."
          />
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
