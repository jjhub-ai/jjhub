import React, { useMemo } from "react";
import { Box, Text, Heading, List, Spinner, StatusBar, type ListItem } from "../primitives";
import { useChanges } from "../hooks";

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

export interface ChangeListProps {
  owner: string;
  name: string;
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function ChangeList({ owner, name, onNavigate }: ChangeListProps) {
  const { changes, loading, error } = useChanges({ owner, repo: name });

  const items: ListItem[] = useMemo(() => {
    if (!changes) return [];
    return changes.map((change) => ({
      key: change.change_id,
      label: `${change.change_id} ${change.description || "(empty)"}`,
      description: `by ${change.author_name} ${formatTimeAgo(change.timestamp)}`,
      badge: change.is_empty
        ? { text: "empty", color: "gray" }
        : change.has_conflict
          ? { text: "conflict", color: "red" }
          : undefined,
    }));
  }, [changes]);

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1}>
        <Heading>
          Changes - {owner}/{name}
        </Heading>
      </Box>

      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {loading ? (
          <Spinner label="Loading changes..." />
        ) : error ? (
          <Text color="red">Error: {error.message}</Text>
        ) : (
          <List
            items={items}
            onSelect={(item) => {
              onNavigate("diff", { owner, name, changeId: item.key });
            }}
          />
        )}
      </Box>

      <StatusBar
        bindings={[
          { key: "j/k", label: "navigate" },
          { key: "Enter", label: "view" },
          { key: "q", label: "back" },
        ]}
        left={`${changes?.length ?? 0} changes`}
      />
    </Box>
  );
}
