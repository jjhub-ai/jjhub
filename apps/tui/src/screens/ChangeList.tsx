import React, { useMemo } from "react";
import { Box, Text, Heading, List, Spinner, StatusBar, ErrorBox, type ListItem } from "../primitives";
import { useChanges } from "../hooks";
import { formatTimeAgo, theme } from "../utils";

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
        ? { text: "empty", color: theme.muted }
        : change.has_conflict
          ? { text: "conflict", color: theme.error }
          : undefined,
    }));
  }, [changes]);

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1}>
        <Heading>Changes</Heading>
      </Box>

      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {loading ? (
          <Spinner label="Loading changes..." />
        ) : error ? (
          <ErrorBox message={error.message} hint="Press q to go back." />
        ) : (
          <List
            items={items}
            emptyMessage="No changes found."
            emptyHint="Push changes to this repository to see them here."
            onSelect={(item) => {
              onNavigate("diff", { owner, name, changeId: item.key });
            }}
          />
        )}
      </Box>

      <StatusBar
        bindings={[
          { key: "j/k", label: "navigate" },
          { key: "Enter", label: "view diff" },
          { key: "q", label: "back" },
        ]}
        left={`${changes?.length ?? 0} changes`}
      />
    </Box>
  );
}
