import React, { useState, useMemo } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, Muted, List, Spinner, StatusBar, type ListItem } from "../primitives";
import { useConflicts, type SyncConflict } from "../hooks";

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
  return `${days}d ago`;
}

function methodColor(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "green";
    case "POST":
      return "yellow";
    case "PUT":
    case "PATCH":
      return "blue";
    case "DELETE":
      return "red";
    default:
      return "white";
  }
}

export interface SyncConflictsProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function SyncConflicts({ onNavigate }: SyncConflictsProps) {
  const { conflicts, loading, error, resolveConflict, retryConflict } = useConflicts();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewingDetail, setViewingDetail] = useState<SyncConflict | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const items: ListItem[] = useMemo(
    () =>
      conflicts.map((conflict) => ({
        key: conflict.id,
        label: `${conflict.method.toUpperCase()} ${conflict.path}`,
        description: `${conflict.error} - ${formatTimeAgo(conflict.created_at)}`,
        badge: { text: conflict.method.toUpperCase(), color: methodColor(conflict.method) },
      })),
    [conflicts],
  );

  const selectedConflict = conflicts[selectedIndex] ?? null;

  useInput((input) => {
    if (viewingDetail) {
      // In detail view, only q/escape goes back (handled globally for escape)
      if (input === "q") {
        setViewingDetail(null);
      }
      return;
    }

    if (input === "r" && selectedConflict) {
      setActionMessage(`Resolving conflict: ${selectedConflict.path}...`);
      resolveConflict(selectedConflict.id).then(() => {
        setActionMessage("Conflict resolved (accepted server value)");
        // Reset selected index if needed
        setSelectedIndex((i) => Math.min(i, Math.max(0, conflicts.length - 2)));
        setTimeout(() => setActionMessage(null), 2000);
      });
      return;
    }

    if (input === "t" && selectedConflict) {
      setActionMessage(`Retrying: ${selectedConflict.path}...`);
      retryConflict(selectedConflict.id).then(() => {
        setActionMessage("Retry queued");
        setTimeout(() => setActionMessage(null), 2000);
      });
      return;
    }

    if (input === "d" && selectedConflict) {
      setViewingDetail(selectedConflict);
      return;
    }
  });

  // Detail view
  if (viewingDetail) {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Box paddingX={1}>
          <Heading>Conflict Detail</Heading>
        </Box>

        <Box flexDirection="column" paddingX={1} paddingY={1} gap={1}>
          <Box gap={1}>
            <Text dimColor>Method:</Text>
            <Text bold color={methodColor(viewingDetail.method)}>
              {viewingDetail.method.toUpperCase()}
            </Text>
          </Box>

          <Box gap={1}>
            <Text dimColor>Path:</Text>
            <Text bold>{viewingDetail.path}</Text>
          </Box>

          <Box gap={1}>
            <Text dimColor>Error:</Text>
            <Text color="red">{viewingDetail.error}</Text>
          </Box>

          <Box gap={1}>
            <Text dimColor>Created:</Text>
            <Text>{viewingDetail.created_at}</Text>
          </Box>

          <Box
            flexDirection="column"
            marginTop={1}
            borderStyle="single"
            borderColor="yellow"
            padding={1}
          >
            <Text bold color="yellow">
              Local Value
            </Text>
            <Text wrap="wrap">
              {viewingDetail.local_value ?? "(no local value captured)"}
            </Text>
          </Box>

          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor="cyan"
            padding={1}
          >
            <Text bold color="cyan">
              Server Value
            </Text>
            <Text wrap="wrap">
              {viewingDetail.server_value ?? "(no server value captured)"}
            </Text>
          </Box>
        </Box>

        <StatusBar
          bindings={[{ key: "q", label: "back to list" }]}
        />
      </Box>
    );
  }

  // List view
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} gap={2}>
        <Heading>Sync Conflicts</Heading>
        {actionMessage && (
          <Text color="yellow">{actionMessage}</Text>
        )}
      </Box>

      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {loading ? (
          <Spinner label="Loading conflicts..." />
        ) : error ? (
          <Text color="red">Error: {error.message}</Text>
        ) : conflicts.length === 0 ? (
          <Box flexDirection="column" paddingY={1}>
            <Text color="green">No sync conflicts</Text>
            <Muted>All changes are synchronized</Muted>
          </Box>
        ) : (
          <List
            items={items}
            onSelect={(item) => {
              const conflict = conflicts.find((c) => c.id === item.key);
              if (conflict) setViewingDetail(conflict);
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
          { key: "r", label: "resolve (accept server)" },
          { key: "t", label: "retry" },
          { key: "d", label: "view details" },
          { key: "q", label: "back" },
        ]}
        left={`${conflicts.length} conflict${conflicts.length !== 1 ? "s" : ""}`}
      />
    </Box>
  );
}
