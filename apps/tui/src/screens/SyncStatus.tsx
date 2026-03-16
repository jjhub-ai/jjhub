import React from "react";
import { useInput } from "ink";
import { Box, Text, Heading, Muted, Spinner, StatusBar, ErrorBox } from "../primitives";
import { useSyncStatus, type SyncState } from "../hooks";
import { statusColor, theme } from "../utils";

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

function syncStatusDot(status: SyncState): string {
  switch (status) {
    case "online": return "\u25CF";
    case "syncing": return "\u25D0";
    case "offline": return "\u25CB";
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

  const syncColor = statusColor(data.status);

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1}>
        <Heading>Sync Status</Heading>
      </Box>

      {error && (
        <Box paddingX={1}>
          <ErrorBox message={error.message} hint="Sync status may be unavailable." />
        </Box>
      )}

      <Box flexDirection="column" paddingX={1} paddingY={1} gap={1}>
        {/* Connection status */}
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={syncColor}
          padding={1}
        >
          <Box gap={1}>
            <Text color={syncColor} bold>
              {syncStatusDot(data.status)}
            </Text>
            <Text bold>Connection Status</Text>
          </Box>
          <Box gap={1} marginTop={1}>
            <Text dimColor>Status:</Text>
            <Text bold color={syncColor}>
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
            borderColor={data.pending > 0 ? theme.warning : theme.border}
            padding={1}
            flexGrow={1}
          >
            <Text bold>Pending Changes</Text>
            <Box gap={1} marginTop={1}>
              <Text
                bold
                color={data.pending > 0 ? theme.warning : theme.success}
              >
                {data.pending}
              </Text>
              <Muted>{data.pending === 1 ? "change" : "changes"} waiting to sync</Muted>
            </Box>
          </Box>

          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor={data.conflicts > 0 ? theme.error : theme.border}
            padding={1}
            flexGrow={1}
          >
            <Text bold>Conflicts</Text>
            <Box gap={1} marginTop={1}>
              <Text
                bold
                color={data.conflicts > 0 ? theme.error : theme.success}
              >
                {data.conflicts}
              </Text>
              <Muted>{data.conflicts === 1 ? "conflict" : "conflicts"} to resolve</Muted>
            </Box>
            {data.conflicts > 0 && (
              <Box marginTop={1}>
                <Text dimColor>Press </Text>
                <Text color={theme.warning} bold>c</Text>
                <Text dimColor> to view conflicts</Text>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      <StatusBar
        connectionStatus={data.status}
        bindings={[
          { key: "s", label: "sync now" },
          { key: "c", label: "view conflicts" },
          { key: "q", label: "back" },
        ]}
      />
    </Box>
  );
}
