import React, { useState, useMemo } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, Muted, List, Spinner, StatusBar, type ListItem } from "../primitives";
import { useRepos } from "../hooks";

export interface DashboardProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [focusPanel, setFocusPanel] = useState<"repos" | "activity">("repos");
  const { repos, loading, error } = useRepos();

  const items: ListItem[] = useMemo(() => {
    if (!repos) return [];
    return repos.map((repo) => ({
      key: repo.name,
      label: repo.name,
      description: repo.description || "",
      badge: repo.is_public
        ? { text: "public", color: "green" }
        : { text: "private", color: "gray" },
    }));
  }, [repos]);

  useInput((input, key) => {
    if (key.tab) {
      setFocusPanel((p) => (p === "repos" ? "activity" : "repos"));
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} paddingY={0}>
        <Heading>JJHub Dashboard</Heading>
      </Box>

      <Box flexDirection="row" flexGrow={1} gap={2} paddingX={1}>
        {/* Repos panel */}
        <Box
          flexDirection="column"
          flexGrow={1}
          borderStyle={focusPanel === "repos" ? "round" : "single"}
          borderColor={focusPanel === "repos" ? "cyan" : "gray"}
          padding={1}
        >
          <Text bold color={focusPanel === "repos" ? "cyan" : "white"}>
            Repositories
          </Text>
          {loading ? (
            <Spinner label="Loading repositories..." />
          ) : error ? (
            <Text color="red">Error: {error.message}</Text>
          ) : items.length === 0 ? (
            <Muted>No repositories found</Muted>
          ) : (
            <List
              items={items}
              active={focusPanel === "repos"}
              onSelect={(item) => {
                const repoName = item.key;
                // Find the repo to get the owner from its name
                // The repo name from the API is just the repo name; the owner comes
                // from the full_name or we derive it. For user repos, we need to
                // split or use the API response. Since UserRepoSummary doesn't have
                // owner, we pass the repo name and let the user disambiguate.
                // In practice the repos endpoint returns repos the user owns/has access to.
                // We'll use the repo name as-is and try to extract owner/name.
                const parts = repoName.split("/");
                if (parts.length === 2) {
                  onNavigate("repo", { owner: parts[0]!, name: parts[1]! });
                } else {
                  // For repos without owner prefix, navigate with name only
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
          borderColor={focusPanel === "activity" ? "cyan" : "gray"}
          padding={1}
        >
          <Text bold color={focusPanel === "activity" ? "cyan" : "white"}>
            Recent Activity
          </Text>
          <Muted>Activity feed coming soon</Muted>
        </Box>
      </Box>

      <StatusBar
        bindings={[
          { key: "j/k", label: "navigate" },
          { key: "Enter", label: "open" },
          { key: "Tab", label: "switch panel" },
          { key: "/", label: "search" },
          { key: "q", label: "quit" },
        ]}
      />
    </Box>
  );
}
