import React from "react";
import { useInput } from "ink";
import { Box, Text, Heading, Label, Spinner, StatusBar, ErrorBox } from "../primitives";
import { useRepoDetail } from "../hooks";
import { formatTimeAgo, theme } from "../utils";

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
      case "a":
        onNavigate("agent-sessions", { owner, name });
        break;
      case "w":
        onNavigate("workspaces", { owner, name });
        break;
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
        <Spinner label={`Loading ${owner}/${name}...`} />
      </Box>
    );
  }

  if (error || !repo) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
        <ErrorBox
          title="Repository Error"
          message={error ? error.message : "Repository not found"}
          hint="Press q to go back."
        />
        <Box flexGrow={1} />
        <StatusBar
          bindings={[{ key: "q", label: "back" }]}
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
        <Box flexDirection="column" borderStyle="round" borderColor={theme.border} padding={1}>
          <Text bold>Repository Info</Text>
          <Label label="Description" value={repo.description || "(no description)"} />
          <Label
            label="Visibility"
            value={repo.is_public ? "public" : "private"}
            valueColor={repo.is_public ? theme.success : theme.warning}
          />
          <Label label="Default bookmark" value={repo.default_bookmark} valueColor={theme.info} />
          <Label label="Last updated" value={formatTimeAgo(repo.updated_at)} />
        </Box>

        {/* Quick navigation hints */}
        <Box flexDirection="column" borderStyle="single" borderColor={theme.border} padding={1}>
          <Text bold dimColor>Quick Navigation</Text>
          <Box gap={2} marginTop={1}>
            <Box gap={1}>
              <Text color={theme.warning} bold>i</Text>
              <Text dimColor>Issues</Text>
            </Box>
            <Box gap={1}>
              <Text color={theme.warning} bold>l</Text>
              <Text dimColor>Landing Requests</Text>
            </Box>
            <Box gap={1}>
              <Text color={theme.warning} bold>c</Text>
              <Text dimColor>Changes</Text>
            </Box>
            <Box gap={1}>
              <Text color={theme.warning} bold>a</Text>
              <Text dimColor>Agent</Text>
            </Box>
            <Box gap={1}>
              <Text color={theme.warning} bold>w</Text>
              <Text dimColor>Workspaces</Text>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box flexGrow={1} />
      <StatusBar
        bindings={[
          { key: "i", label: "issues" },
          { key: "l", label: "landings" },
          { key: "c", label: "changes" },
          { key: "a", label: "agent" },
          { key: "w", label: "workspaces" },
          { key: "q", label: "back" },
        ]}
        left={`${owner}/${name}`}
      />
    </Box>
  );
}
