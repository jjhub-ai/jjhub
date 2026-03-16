import React, { useState, useMemo } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, List, Spinner, StatusBar, ErrorBox, EmptyState, type ListItem } from "../primitives";
import { useConflicts, type SyncConflict } from "../hooks";
import { formatTimeAgo, methodColor, theme } from "../utils";

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
      if (input === "q") {
        setViewingDetail(null);
      }
      return;
    }

    if (input === "r" && selectedConflict) {
      setActionMessage(`Resolving conflict: ${selectedConflict.path}...`);
      resolveConflict(selectedConflict.id).then(() => {
        setActionMessage("Conflict resolved (accepted server value)");
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
            <Text color={theme.error}>{viewingDetail.error}</Text>
          </Box>

          <Box gap={1}>
            <Text dimColor>Created:</Text>
            <Text>{formatTimeAgo(viewingDetail.created_at)}</Text>
          </Box>

          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor={theme.warning}
            padding={1}
          >
            <Text bold color={theme.warning}>
              Local Value
            </Text>
            <Text wrap="wrap">
              {viewingDetail.local_value ?? "(no local value captured)"}
            </Text>
          </Box>

          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor={theme.info}
            padding={1}
          >
            <Text bold color={theme.info}>
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
          <Text color={theme.warning}>{actionMessage}</Text>
        )}
      </Box>

      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {loading ? (
          <Spinner label="Loading sync conflicts..." />
        ) : error ? (
          <ErrorBox message={error.message} hint="Press q to go back." />
        ) : conflicts.length === 0 ? (
          <EmptyState
            message="No sync conflicts. All changes are synchronized."
            icon="\u2714"
          />
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
          { key: "r", label: "resolve" },
          { key: "t", label: "retry" },
          { key: "d", label: "details" },
          { key: "q", label: "back" },
        ]}
        left={`${conflicts.length} conflict${conflicts.length !== 1 ? "s" : ""}`}
      />
    </Box>
  );
}
