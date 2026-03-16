import React, { useState } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, List, StatusBar, type ListItem } from "../primitives";

type IssueState = "open" | "closed" | "all";

// Mock data — will be replaced with @jjhub/sdk calls
const MOCK_ISSUES = [
  { id: 145, title: "Fix SSH key rotation on session expiry", state: "open", labels: ["bug", "auth"], author: "wcory", comments: 3, created: "2h ago" },
  { id: 142, title: "Add stacked change rebase on conflict", state: "open", labels: ["enhancement"], author: "smithers", comments: 1, created: "1d ago" },
  { id: 139, title: "Workflow runner timeout not respected", state: "open", labels: ["bug", "runner"], author: "wcory", comments: 7, created: "2d ago" },
  { id: 137, title: "Support org-level workflow secrets", state: "open", labels: ["enhancement"], author: "wcory", comments: 0, created: "3d ago" },
  { id: 135, title: "Landing queue deadlock with concurrent LRs", state: "open", labels: ["bug", "critical"], author: "smithers", comments: 12, created: "4d ago" },
  { id: 130, title: "Add webhook retry with backoff", state: "closed", labels: ["enhancement"], author: "wcory", comments: 2, created: "1w ago" },
  { id: 128, title: "CLI: add --json flag to all commands", state: "closed", labels: ["cli"], author: "wcory", comments: 0, created: "1w ago" },
  { id: 125, title: "SSE connection drops after 30s idle", state: "closed", labels: ["bug"], author: "smithers", comments: 5, created: "2w ago" },
];

function stateColor(state: string): string {
  return state === "open" ? "green" : "red";
}

export interface IssueListProps {
  owner: string;
  name: string;
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function IssueList({ owner, name, onNavigate }: IssueListProps) {
  const [filter, setFilter] = useState<IssueState>("open");

  const filtered = MOCK_ISSUES.filter((issue) => {
    if (filter === "all") return true;
    return issue.state === filter;
  });

  const items: ListItem[] = filtered.map((issue) => ({
    key: String(issue.id),
    label: `#${issue.id} ${issue.title}`,
    description: `by ${issue.author} ${issue.created}`,
    badge: { text: issue.state, color: stateColor(issue.state) },
  }));

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
