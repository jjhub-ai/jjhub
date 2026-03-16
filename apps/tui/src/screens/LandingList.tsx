import React, { useState } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, List, StatusBar, type ListItem } from "../primitives";

type LRState = "open" | "landed" | "rejected" | "all";

// Mock data — will be replaced with @jjhub/sdk calls
const MOCK_LRS = [
  { id: 42, title: "Add stacked change support", state: "open", author: "wcory", bookmark: "feat/stacked-changes", changes: 3, created: "1d ago" },
  { id: 41, title: "Fix landing queue serialization", state: "open", author: "smithers", bookmark: "fix/queue", changes: 1, created: "2d ago" },
  { id: 40, title: "Implement org-level permissions", state: "open", author: "wcory", bookmark: "feat/org-perms", changes: 5, created: "3d ago" },
  { id: 39, title: "Add SSE reconnect logic", state: "landed", author: "wcory", bookmark: "fix/sse-reconnect", changes: 2, created: "4d ago" },
  { id: 38, title: "CLI: workflow run command", state: "landed", author: "smithers", bookmark: "feat/workflow-run", changes: 4, created: "5d ago" },
  { id: 37, title: "Broken webhook delivery", state: "rejected", author: "wcory", bookmark: "fix/webhooks", changes: 1, created: "1w ago" },
];

function stateColor(state: string): string {
  switch (state) {
    case "open":
      return "green";
    case "landed":
      return "cyan";
    case "rejected":
      return "red";
    default:
      return "white";
  }
}

export interface LandingListProps {
  owner: string;
  name: string;
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function LandingList({ owner, name, onNavigate }: LandingListProps) {
  const [filter, setFilter] = useState<LRState>("open");

  const filtered = MOCK_LRS.filter((lr) => {
    if (filter === "all") return true;
    return lr.state === filter;
  });

  const items: ListItem[] = filtered.map((lr) => ({
    key: String(lr.id),
    label: `!${lr.id} ${lr.title}`,
    description: `${lr.bookmark} (${lr.changes} changes) by ${lr.author} ${lr.created}`,
    badge: { text: lr.state, color: stateColor(lr.state) },
  }));

  useInput((input) => {
    if (input === "o") setFilter("open");
    if (input === "l") setFilter("landed");
    if (input === "r") setFilter("rejected");
    if (input === "a") setFilter("all");
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} gap={2}>
        <Heading>
          Landing Requests - {owner}/{name}
        </Heading>
        <Box gap={1}>
          {(["open", "landed", "rejected", "all"] as const).map((f) => (
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
            onNavigate("landing-detail", {
              owner,
              name,
              lrId: item.key,
            });
          }}
        />
      </Box>

      <StatusBar
        bindings={[
          { key: "j/k", label: "navigate" },
          { key: "Enter", label: "view" },
          { key: "o", label: "open" },
          { key: "l", label: "landed" },
          { key: "r", label: "rejected" },
          { key: "a", label: "all" },
          { key: "q", label: "back" },
        ]}
        left={`${filtered.length} landing requests`}
      />
    </Box>
  );
}
