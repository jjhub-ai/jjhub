import React from "react";
import { useInput } from "ink";
import { Box, Text, Heading, Label, Muted, Spinner, StatusBar } from "../primitives";
import { useRepoDetail } from "../hooks";

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

export interface RepoOverviewProps {
  owner: string;
  name: string;
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function RepoOverview({ owner, name, onNavigate }: RepoOverviewProps) {
  const { repo, loading, error } = useRepoDetail({ owner, repo: name });

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

  if (loading) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
        <Spinner label="Loading repository..." />
      </Box>
    );
  }

  if (error || !repo) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
        <Text color="red">
          {error ? `Error: ${error.message}` : "Repository not found"}
        </Text>
        <StatusBar
          bindings={[
            { key: "q", label: "back" },
          ]}
          left={`${owner}/${name}`}
        />
      </Box>
    );
  }

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
          <Label label="Description" value={repo.description || "(no description)"} />
          <Label
            label="Visibility"
            value={repo.is_public ? "public" : "private"}
            valueColor={repo.is_public ? "green" : "yellow"}
          />
          <Label label="Default bookmark" value={repo.default_bookmark} valueColor="cyan" />
          <Label label="Last updated" value={formatTimeAgo(repo.updated_at)} />
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
