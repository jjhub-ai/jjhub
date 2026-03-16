import React from "react";
import { useInput } from "ink";
import { Box, Text, Heading, Label, Muted, StatusBar } from "../primitives";

// Mock data — will be replaced with @jjhub/sdk calls
const MOCK_REPO = {
  fullName: "jjhub-ai/jjhub",
  description: "jj-native code hosting platform",
  defaultBookmark: "main",
  bookmarks: ["main", "feat/tui", "feat/stacked-changes", "fix/ssh-auth"],
  issueCount: 12,
  openLRCount: 3,
  changeCount: 847,
  stars: 42,
  visibility: "public" as const,
  lastUpdated: "2 hours ago",
};

export interface RepoOverviewProps {
  owner: string;
  name: string;
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function RepoOverview({ owner, name, onNavigate }: RepoOverviewProps) {
  useInput((input) => {
    switch (input) {
      case "i":
        onNavigate("issues", { owner, name });
        break;
      case "l":
        onNavigate("landings", { owner, name });
        break;
      case "c":
        onNavigate("changes", { owner, name });
        break;
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1}>
        <Heading>
          {owner}/{name}
        </Heading>
      </Box>

      <Box flexDirection="column" paddingX={2} gap={1}>
        {/* Info section */}
        <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1}>
          <Text bold>Repository Info</Text>
          <Label label="Description" value={MOCK_REPO.description} />
          <Label label="Visibility" value={MOCK_REPO.visibility} valueColor="green" />
          <Label label="Default bookmark" value={MOCK_REPO.defaultBookmark} valueColor="cyan" />
          <Label label="Last updated" value={MOCK_REPO.lastUpdated} />
        </Box>

        {/* Stats */}
        <Box flexDirection="row" gap={4}>
          <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1} width={20}>
            <Text bold color="yellow">Issues</Text>
            <Text bold>{String(MOCK_REPO.issueCount)}</Text>
          </Box>
          <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1} width={20}>
            <Text bold color="magenta">Landing Requests</Text>
            <Text bold>{String(MOCK_REPO.openLRCount)}</Text>
          </Box>
          <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1} width={20}>
            <Text bold color="cyan">Changes</Text>
            <Text bold>{String(MOCK_REPO.changeCount)}</Text>
          </Box>
          <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1} width={20}>
            <Text bold color="green">Stars</Text>
            <Text bold>{String(MOCK_REPO.stars)}</Text>
          </Box>
        </Box>

        {/* Bookmarks */}
        <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1}>
          <Text bold>Bookmarks</Text>
          {MOCK_REPO.bookmarks.map((b) => (
            <Box key={b} gap={1}>
              <Text color={b === MOCK_REPO.defaultBookmark ? "green" : "white"}>
                {b === MOCK_REPO.defaultBookmark ? "*" : " "} {b}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>

      <Box flexGrow={1} />
      <StatusBar
        bindings={[
          { key: "i", label: "issues" },
          { key: "l", label: "landing requests" },
          { key: "c", label: "changes" },
          { key: "q", label: "back" },
        ]}
        left={`${owner}/${name}`}
      />
    </Box>
  );
}
