import React, { useState, useMemo } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, List, Spinner, StatusBar, type ListItem } from "../primitives";
import { useWorkspaces } from "../hooks";

function statusColor(status: string): string {
  switch (status) {
    case "running":
      return "green";
    case "suspended":
    case "creating":
      return "yellow";
    case "failed":
    case "deleting":
      return "red";
    default:
      return "gray";
  }
}

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

export interface WorkspaceListProps {
  owner: string;
  name: string;
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function WorkspaceList({ owner, name, onNavigate }: WorkspaceListProps) {
  const { workspaces, loading, error, suspend, resume, remove, refetch } = useWorkspaces({
    owner,
    repo: name,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const items: ListItem[] = useMemo(
    () =>
      (workspaces ?? []).map((ws) => ({
        key: ws.id,
        label: ws.name,
        description: `${ws.bookmark}  ${formatTimeAgo(ws.last_activity)}`,
        badge: { text: ws.status, color: statusColor(ws.status) },
      })),
    [workspaces],
  );

  useInput((input) => {
    if (!workspaces || workspaces.length === 0) {
      if (input === "c") {
        onNavigate("workspace-create", { owner, name });
      }
      return;
    }

    const selected = workspaces[selectedIndex];
    if (!selected) return;

    setActionError(null);

    if (input === "s" && selected.status === "running") {
      suspend(selected.id).catch((err) =>
        setActionError(err instanceof Error ? err.message : String(err)),
      );
      return;
    }

    if (input === "r" && selected.status === "suspended") {
      resume(selected.id).catch((err) =>
        setActionError(err instanceof Error ? err.message : String(err)),
      );
      return;
    }

    if (input === "d") {
      remove(selected.id).catch((err) =>
        setActionError(err instanceof Error ? err.message : String(err)),
      );
      return;
    }

    if (input === "c") {
      onNavigate("workspace-create", { owner, name });
      return;
    }

    if (input === "R") {
      refetch();
      return;
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} gap={2}>
        <Heading>
          Workspaces - {owner}/{name}
        </Heading>
      </Box>

      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {actionError && (
          <Box paddingBottom={1}>
            <Text color="red">Error: {actionError}</Text>
          </Box>
        )}

        {loading ? (
          <Spinner label="Loading workspaces..." />
        ) : error ? (
          <Text color="red">Error: {error.message}</Text>
        ) : items.length === 0 ? (
          <Box flexDirection="column" paddingY={1}>
            <Text dimColor>No workspaces found.</Text>
            <Text dimColor>
              Press <Text color="yellow" bold>c</Text> to create one.
            </Text>
          </Box>
        ) : (
          <List
            items={items}
            onSelect={(item) => {
              onNavigate("workspace-detail", {
                owner,
                name,
                workspaceId: item.key,
              });
            }}
            onHighlight={(_item, index) => {
              setSelectedIndex(index);
            }}
          />
        )}
      </Box>

      <StatusBar
        bindings={[
          { key: "j/k", label: "navigate" },
          { key: "Enter", label: "details" },
          { key: "s", label: "suspend" },
          { key: "r", label: "resume" },
          { key: "d", label: "delete" },
          { key: "c", label: "create" },
          { key: "q", label: "back" },
        ]}
        left={`${workspaces?.length ?? 0} workspaces`}
      />
    </Box>
  );
}
