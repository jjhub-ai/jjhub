import React, { useState, useMemo } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, List, Spinner, StatusBar, ErrorBox, type ListItem } from "../primitives";
import { useIssues } from "../hooks";
import { formatTimeAgo, issueStateColor, theme } from "../utils";

type IssueState = "open" | "closed" | "all";

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
        badge: { text: issue.state, color: issueStateColor(issue.state) },
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
        <Heading>Issues</Heading>
        <Box gap={1}>
          {(["open", "closed", "all"] as const).map((f) => (
            <Text
              key={f}
              bold={filter === f}
              color={filter === f ? theme.accent : theme.muted}
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
          <ErrorBox message={error.message} hint="Press q to go back." />
        ) : (
          <List
            items={items}
            emptyMessage={`No ${filter === "all" ? "" : filter + " "}issues found.`}
            emptyHint="Press 'c' to create one via the command palette."
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
