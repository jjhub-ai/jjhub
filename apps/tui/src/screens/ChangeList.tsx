import React from "react";
import { Box, Text, Heading, List, StatusBar, type ListItem } from "../primitives";

// Mock data — will be replaced with @jjhub/sdk calls
const MOCK_CHANGES = [
  { changeId: "kxyzpqr", description: "Add change dependency graph parser", author: "wcory", bookmark: "feat/stacked-changes", timestamp: "3h ago", empty: false },
  { changeId: "mwvutsr", description: "Implement landing queue rebase for stacks", author: "wcory", bookmark: "feat/stacked-changes", timestamp: "3h ago", empty: false },
  { changeId: "nqponml", description: "Add stack indicators to landing request API", author: "wcory", bookmark: "feat/stacked-changes", timestamp: "3h ago", empty: false },
  { changeId: "pabcdef", description: "Fix SSH key rotation on session expiry", author: "wcory", bookmark: "fix/ssh-auth", timestamp: "5h ago", empty: false },
  { changeId: "rstuvwx", description: "Update CLAUDE.md with TUI architecture", author: "wcory", bookmark: "main", timestamp: "1d ago", empty: false },
  { changeId: "qyzabcd", description: "(empty)", author: "wcory", bookmark: "main", timestamp: "1d ago", empty: true },
  { changeId: "wefghij", description: "Add webhook retry with exponential backoff", author: "smithers", bookmark: "main", timestamp: "2d ago", empty: false },
  { changeId: "xklmnop", description: "Implement SSE reconnect with backoff", author: "wcory", bookmark: "main", timestamp: "3d ago", empty: false },
  { changeId: "yqrstuv", description: "CLI: add workflow run command", author: "smithers", bookmark: "main", timestamp: "4d ago", empty: false },
  { changeId: "zwxyzab", description: "Add organization service with team support", author: "wcory", bookmark: "main", timestamp: "5d ago", empty: false },
];

export interface ChangeListProps {
  owner: string;
  name: string;
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function ChangeList({ owner, name, onNavigate }: ChangeListProps) {
  const items: ListItem[] = MOCK_CHANGES.map((change) => ({
    key: change.changeId,
    label: `${change.changeId} ${change.description}`,
    description: `${change.bookmark} by ${change.author} ${change.timestamp}`,
    badge: change.empty
      ? { text: "empty", color: "gray" }
      : undefined,
  }));

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1}>
        <Heading>
          Changes - {owner}/{name}
        </Heading>
      </Box>

      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <List
          items={items}
          onSelect={(item) => {
            // Future: navigate to change detail
          }}
        />
      </Box>

      <StatusBar
        bindings={[
          { key: "j/k", label: "navigate" },
          { key: "Enter", label: "view" },
          { key: "q", label: "back" },
        ]}
        left={`${MOCK_CHANGES.length} changes`}
      />
    </Box>
  );
}
