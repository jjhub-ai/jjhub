import React, { useState } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, Muted, List, StatusBar, type ListItem } from "../primitives";

// Mock data — will be replaced with @jjhub/ui-core hooks
const MOCK_REPOS: ListItem[] = [
  {
    key: "jjhub-ai/jjhub",
    label: "jjhub-ai/jjhub",
    description: "jj-native code hosting platform",
    badge: { text: "12 issues", color: "yellow" },
  },
  {
    key: "jjhub-ai/smithers",
    label: "jjhub-ai/smithers",
    description: "AI workflow orchestration with JSX",
    badge: { text: "3 issues", color: "green" },
  },
  {
    key: "jjhub-ai/jjhub-ffi",
    label: "jjhub-ai/jjhub-ffi",
    description: "C ABI wrapper around jj-lib",
    badge: { text: "1 issue", color: "green" },
  },
  {
    key: "jjhub-ai/docs",
    label: "jjhub-ai/docs",
    description: "Documentation site",
    badge: { text: "0 issues", color: "gray" },
  },
];

const MOCK_ACTIVITY = [
  { time: "2m ago", action: "opened issue", detail: "Fix SSH key rotation #145", repo: "jjhub-ai/jjhub" },
  { time: "15m ago", action: "landed LR", detail: "Add stacked change support #42", repo: "jjhub-ai/jjhub" },
  { time: "1h ago", action: "pushed changes", detail: "3 changes to main", repo: "jjhub-ai/smithers" },
  { time: "2h ago", action: "commented", detail: "on issue #89", repo: "jjhub-ai/jjhub" },
  { time: "3h ago", action: "created repo", detail: "jjhub-ai/jjhub-ffi", repo: "jjhub-ai/jjhub-ffi" },
];

export interface DashboardProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [focusPanel, setFocusPanel] = useState<"repos" | "activity">("repos");

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
          <List
            items={MOCK_REPOS}
            active={focusPanel === "repos"}
            onSelect={(item) => {
              const [owner, name] = item.key.split("/");
              onNavigate("repo", { owner: owner!, name: name! });
            }}
          />
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
          <Box flexDirection="column" gap={0}>
            {MOCK_ACTIVITY.map((a, i) => (
              <Box key={i} gap={1}>
                <Text dimColor>{a.time.padEnd(8)}</Text>
                <Text color="green">{a.action}</Text>
                <Text>{a.detail}</Text>
                <Muted>{a.repo}</Muted>
              </Box>
            ))}
          </Box>
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
