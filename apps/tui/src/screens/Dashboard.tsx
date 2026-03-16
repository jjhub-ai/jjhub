import React, { useState, useMemo } from "react";
import { useInput, useStdout } from "ink";
import { Box, Text, Heading, Muted, List, Spinner, StatusBar, ErrorBox, EmptyState, type ListItem } from "../primitives";
import { useRepos, useSyncStatus } from "../hooks";
import { formatTimeAgo, theme } from "../utils";

export interface DashboardProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [focusPanel, setFocusPanel] = useState<"repos" | "activity">("repos");
  const { repos, loading, error } = useRepos();
  const { data: syncData } = useSyncStatus();

  const { stdout } = useStdout();
  const termWidth = stdout?.columns ?? 80;
  const isCompact = termWidth < 80;

  const items: ListItem[] = useMemo(() => {
    if (!repos) return [];
    return repos.map((repo) => ({
      key: repo.name,
      label: repo.name,
      description: repo.description || "",
      badge: repo.is_public
        ? { text: "public", color: theme.success }
        : { text: "private", color: theme.muted },
    }));
  }, [repos]);

  useInput((input, key) => {
    if (key.tab) {
      setFocusPanel((p) => (p === "repos" ? "activity" : "repos"));
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} paddingY={0} gap={2}>
        <Heading>Dashboard</Heading>
        <Box gap={1}>
          <Text
            color={
              syncData.status === "online"
                ? theme.success
                : syncData.status === "syncing"
                  ? theme.warning
                  : theme.error
            }
          >
            {syncData.status === "online"
              ? "\u25CF"
              : syncData.status === "syncing"
                ? "\u25D0"
                : "\u25CB"}
          </Text>
          <Text dimColor>
            {syncData.status === "syncing" ? "syncing" : syncData.status}
          </Text>
          {syncData.pending > 0 && (
            <Text color={theme.warning}>({syncData.pending} pending)</Text>
          )}
          {syncData.conflicts > 0 && (
            <Text color={theme.error}>({syncData.conflicts} conflicts)</Text>
          )}
        </Box>
      </Box>

      {isCompact ? (
        /* Compact single-column layout for narrow terminals */
        <Box flexDirection="column" flexGrow={1} paddingX={1}>
          <Box
            flexDirection="column"
            flexGrow={1}
            borderStyle={focusPanel === "repos" ? "round" : "single"}
            borderColor={focusPanel === "repos" ? theme.borderFocused : theme.border}
            padding={1}
          >
            <Text bold color={focusPanel === "repos" ? theme.accent : "white"}>
              Repositories
            </Text>
            {loading ? (
              <Spinner label="Loading repositories..." />
            ) : error ? (
              <ErrorBox message={error.message} hint="Check your connection and try again." />
            ) : items.length === 0 ? (
              <EmptyState
                message="No repositories found."
                hint="Create a repository to get started."
              />
            ) : (
              <List
                items={items}
                active={focusPanel === "repos"}
                emptyMessage="No repositories found."
                onSelect={(item) => {
                  const repoName = item.key;
                  const parts = repoName.split("/");
                  if (parts.length === 2) {
                    onNavigate("repo", { owner: parts[0]!, name: parts[1]! });
                  } else {
                    onNavigate("repo", { owner: "", name: repoName });
                  }
                }}
              />
            )}
          </Box>
        </Box>
      ) : (
        /* Full two-column layout */
        <Box flexDirection="row" flexGrow={1} gap={2} paddingX={1}>
          {/* Repos panel */}
          <Box
            flexDirection="column"
            flexGrow={1}
            borderStyle={focusPanel === "repos" ? "round" : "single"}
            borderColor={focusPanel === "repos" ? theme.borderFocused : theme.border}
            padding={1}
          >
            <Text bold color={focusPanel === "repos" ? theme.accent : "white"}>
              Repositories
            </Text>
            {loading ? (
              <Spinner label="Loading repositories..." />
            ) : error ? (
              <ErrorBox message={error.message} hint="Check your connection and try again." />
            ) : items.length === 0 ? (
              <EmptyState
                message="No repositories found."
                hint="Create a repository to get started."
              />
            ) : (
              <List
                items={items}
                active={focusPanel === "repos"}
                emptyMessage="No repositories found."
                onSelect={(item) => {
                  const repoName = item.key;
                  const parts = repoName.split("/");
                  if (parts.length === 2) {
                    onNavigate("repo", { owner: parts[0]!, name: parts[1]! });
                  } else {
                    onNavigate("repo", { owner: "", name: repoName });
                  }
                }}
              />
            )}
          </Box>

          {/* Activity panel */}
          <Box
            flexDirection="column"
            flexGrow={1}
            borderStyle={focusPanel === "activity" ? "round" : "single"}
            borderColor={focusPanel === "activity" ? theme.borderFocused : theme.border}
            padding={1}
          >
            <Text bold color={focusPanel === "activity" ? theme.accent : "white"}>
              Recent Activity
            </Text>
            <EmptyState message="Activity feed coming soon." />
          </Box>
        </Box>
      )}

      <StatusBar
        connectionStatus={syncData.status}
        bindings={[
          { key: "j/k", label: "navigate" },
          { key: "Enter", label: "open" },
          { key: "Tab", label: "panel" },
          { key: "/", label: "search" },
          { key: "S", label: "sync" },
          { key: "q", label: "quit" },
        ]}
      />
    </Box>
  );
}
