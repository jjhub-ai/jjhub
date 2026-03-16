import React from "react";
import { Box, Text, Heading, Label, Muted, ScrollView, StatusBar } from "../primitives";

// Mock data — will be replaced with @jjhub/sdk calls
const MOCK_ISSUE = {
  id: 145,
  title: "Fix SSH key rotation on session expiry",
  state: "open",
  author: "wcory",
  created: "2 hours ago",
  labels: ["bug", "auth"],
  milestone: "v0.1.0",
  assignees: ["wcory"],
  body: `When an SSH session expires, the key rotation doesn't properly invalidate
the old key. This causes intermittent auth failures when pushing changes.

## Steps to Reproduce

1. Create an SSH key and add it to JJHub
2. Wait for the session to expire (or set a short TTL)
3. Try to push a change

## Expected Behavior

The key should be seamlessly rotated and the push should succeed.

## Actual Behavior

The push fails with "authentication failed" error.`,
  comments: [
    {
      author: "smithers",
      created: "1 hour ago",
      body: "I can reproduce this. Looks like the key cache isn't being invalidated when the session expires. The `KeyAuthVerifier` holds a stale reference.",
    },
    {
      author: "wcory",
      created: "45 minutes ago",
      body: "Good catch. I think we need to add a TTL to the key cache in the verifier. Let me push a fix.",
    },
    {
      author: "smithers",
      created: "30 minutes ago",
      body: "Also worth checking if this affects the `git-receive-pack` path — the SSH handler there might have the same issue.",
    },
  ],
};

function labelColor(label: string): string {
  const colors: Record<string, string> = {
    bug: "red",
    enhancement: "green",
    auth: "yellow",
    critical: "redBright",
    cli: "blue",
    runner: "magenta",
  };
  return colors[label] ?? "white";
}

export interface IssueDetailProps {
  owner: string;
  name: string;
  issueId: string;
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function IssueDetail({ owner, name, issueId, onNavigate }: IssueDetailProps) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} gap={1}>
        <Text color="gray">#{issueId}</Text>
        <Heading>{MOCK_ISSUE.title}</Heading>
        <Text color={MOCK_ISSUE.state === "open" ? "green" : "red"} bold>
          [{MOCK_ISSUE.state}]
        </Text>
      </Box>

      <ScrollView maxVisible={20}>
        {/* Metadata */}
        <Box flexDirection="column" paddingX={2} paddingY={1} key="meta">
          <Box flexDirection="row" gap={4}>
            <Label label="Author" value={MOCK_ISSUE.author} valueColor="cyan" />
            <Label label="Created" value={MOCK_ISSUE.created} />
            <Label label="Milestone" value={MOCK_ISSUE.milestone} valueColor="yellow" />
          </Box>
          <Box gap={1}>
            <Text dimColor>Labels:</Text>
            {MOCK_ISSUE.labels.map((l) => (
              <Text key={l} color={labelColor(l)} bold>
                [{l}]
              </Text>
            ))}
          </Box>
          <Box gap={1}>
            <Text dimColor>Assignees:</Text>
            {MOCK_ISSUE.assignees.map((a) => (
              <Text key={a} color="cyan">
                @{a}
              </Text>
            ))}
          </Box>
        </Box>

        {/* Body */}
        <Box
          key="body"
          flexDirection="column"
          paddingX={2}
          borderStyle="single"
          borderColor="gray"
        >
          <Text bold>Description</Text>
          <Text>{MOCK_ISSUE.body}</Text>
        </Box>

        {/* Separator */}
        <Box key="sep" paddingX={2} paddingY={1}>
          <Text dimColor>
            {"--- Comments (" + MOCK_ISSUE.comments.length + ") ---"}
          </Text>
        </Box>

        {/* Comments */}
        {MOCK_ISSUE.comments.map((comment, i) => (
          <Box
            key={`comment-${i}`}
            flexDirection="column"
            paddingX={2}
            paddingY={0}
            borderStyle="single"
            borderColor="gray"
          >
            <Box gap={2}>
              <Text color="cyan" bold>
                @{comment.author}
              </Text>
              <Muted>{comment.created}</Muted>
            </Box>
            <Text>{comment.body}</Text>
          </Box>
        ))}
      </ScrollView>

      <StatusBar
        bindings={[
          { key: "j/k", label: "scroll" },
          { key: "q", label: "back" },
        ]}
        left={`${owner}/${name} #${issueId}`}
      />
    </Box>
  );
}
