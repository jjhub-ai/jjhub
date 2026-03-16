import React from "react";
import { useInput } from "ink";
import { Box, Text, Heading, Muted, Spinner, StatusBar } from "../primitives";
import { useSyncStatus, type SyncState } from "../hooks";

function formatLastSync(lastSync: string | null): string {
  if (!lastSync) return "never";
  const date = new Date(lastSync);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function statusColor(status: SyncState): string {
  switch (status) {
    case "online":
      return "green";
    case "syncing":
      return "yellow";
    case "offline":
      return "red";
  }
}

function statusDot(status: SyncState): string {
  switch (status) {
    case "online":
      return "●";
    case "syncing":
      return "◐";
    case "offline":
      return "○";
  }
}

export interface SyncStatusProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function SyncStatus({ onNavigate }: SyncStatusProps) {
  const { data, loading, error, triggerSync } = useSyncStatus();

  useInput((input) => {
    if (input === "s") {
      triggerSync();
      return;
    }

    if (input === "c") {
      onNavigate("sync-conflicts");
      return;
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Box paddingX={1}>
          <Heading>Sync Status</Heading>
        </Box>
        <Box paddingX={1}>
          <Spinner label="Loading sync status..." />
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1}>
        <Heading>Sync Status</Heading>
      </Box>

      {error && (
        <Box paddingX={1}>
          <Text color="red">Error: {error.message}</Text>
        </Box>
      )}

      <Box flexDirection="column" paddingX={1} paddingY={1} gap={1}>
        {/* Connection status */}
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={statusColor(data.status)}
          padding={1}
        >
          <Box gap={1}>
            <Text color={statusColor(data.status)} bold>
              {statusDot(data.status)}
            </Text>
            <Text bold>Connection Status</Text>
          </Box>
          <Box gap={1} marginTop={1}>
            <Text dimColor>Status:</Text>
            <Text bold color={statusColor(data.status)}>
              {data.status === "syncing" ? "Syncing..." : data.status.toUpperCase()}
            </Text>
          </Box>
          <Box gap={1}>
            <Text dimColor>Last Sync:</Text>
            <Text>{formatLastSync(data.lastSync)}</Text>
          </Box>
          {data.remote && (
            <Box gap={1}>
              <Text dimColor>Remote:</Text>
              <Text>{data.remote}</Text>
            </Box>
          )}
        </Box>

        {/* Queue stats */}
        <Box flexDirection="row" gap={2}>
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor={data.pending > 0 ? "yellow" : "gray"}
            padding={1}
            flexGrow={1}
          >
            <Text bold>Pending Changes</Text>
            <Box gap={1} marginTop={1}>
              <Text
                bold
                color={data.pending > 0 ? "yellow" : "green"}
              >
                {data.pending}
              </Text>
              <Muted>{data.pending === 1 ? "change" : "changes"} waiting to sync</Muted>
            </Box>
          </Box>

          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor={data.conflicts > 0 ? "red" : "gray"}
            padding={1}
            flexGrow={1}
          >
            <Text bold>Conflicts</Text>
            <Box gap={1} marginTop={1}>
              <Text
                bold
                color={data.conflicts > 0 ? "red" : "green"}
              >
                {data.conflicts}
              </Text>
              <Muted>{data.conflicts === 1 ? "conflict" : "conflicts"} to resolve</Muted>
            </Box>
            {data.conflicts > 0 && (
              <Box marginTop={1}>
                <Text dimColor>Press </Text>
                <Text color="yellow" bold>c</Text>
                <Text dimColor> to view conflicts</Text>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      <StatusBar
        bindings={[
          { key: "s", label: "sync now" },
          { key: "c", label: "view conflicts" },
          { key: "q", label: "back" },
        ]}
      />
    </Box>
  );
}
