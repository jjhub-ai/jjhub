import React, { useState, useMemo } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, List, Spinner, StatusBar, type ListItem } from "../primitives";
import { useIssues } from "../hooks";

type IssueState = "open" | "closed" | "all";

function stateColor(state: string): string {
  return state === "open" ? "green" : "red";
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

export interface IssueListProps {
  owner: string;
  name: string;
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function IssueList({ owner, name, onNavigate }: IssueListProps) {
  const [filter, setFilter] = useState<IssueState>("open");
  const { issues, loading, error } = useIssues({ owner, repo: name });

  const filtered = useMemo(() => {
    if (!issues) return [];
    return issues.filter((issue) => {
      if (filter === "all") return true;
      return issue.state === filter;
    });
  }, [issues, filter]);

  const items: ListItem[] = useMemo(
    () =>
      filtered.map((issue) => ({
        key: String(issue.number),
        label: `#${issue.number} ${issue.title}`,
        description: `by ${issue.author.login} ${formatTimeAgo(issue.created_at)}`,
        badge: { text: issue.state, color: stateColor(issue.state) },
      })),
    [filtered],
  );

  useInput((input) => {
    if (input === "o") setFilter("open");
    if (input === "c") setFilter("closed");
    if (input === "a") setFilter("all");
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} gap={2}>
        <Heading>
          Issues - {owner}/{name}
        </Heading>
        <Box gap={1}>
          {(["open", "closed", "all"] as const).map((f) => (
            <Text
              key={f}
              bold={filter === f}
              color={filter === f ? "cyan" : "gray"}
            >
              [{f}]
            </Text>
          ))}
        </Box>
      </Box>

      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {loading ? (
          <Spinner label="Loading issues..." />
        ) : error ? (
          <Text color="red">Error: {error.message}</Text>
        ) : (
          <List
            items={items}
            onSelect={(item) => {
              onNavigate("issue-detail", {
                owner,
                name,
                issueId: item.key,
              });
            }}
          />
        )}
      </Box>

      <StatusBar
        bindings={[
          { key: "j/k", label: "navigate" },
          { key: "Enter", label: "view" },
          { key: "o", label: "open" },
          { key: "c", label: "closed" },
          { key: "a", label: "all" },
          { key: "q", label: "back" },
        ]}
        left={`${filtered.length} issues`}
      />
    </Box>
  );
}
