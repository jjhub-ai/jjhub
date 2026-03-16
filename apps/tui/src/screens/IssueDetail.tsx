import React from "react";
import { Box, Text, Heading, Label, Muted, ScrollView, Spinner, StatusBar } from "../primitives";
import { useIssueDetail } from "../hooks";

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

export interface IssueDetailProps {
  owner: string;
  name: string;
  issueId: string;
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function IssueDetail({ owner, name, issueId, onNavigate }: IssueDetailProps) {
  const issueNumber = parseInt(issueId, 10);
  const { issue, comments, loading, error } = useIssueDetail(
    { owner, repo: name },
    issueNumber,
  );

  if (loading) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
        <Spinner label="Loading issue..." />
      </Box>
    );
  }

  if (error || !issue) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
        <Text color="red">
          {error ? `Error: ${error.message}` : "Issue not found"}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} gap={1}>
        <Text color="gray">#{issue.number}</Text>
        <Heading>{issue.title}</Heading>
        <Text color={issue.state === "open" ? "green" : "red"} bold>
          [{issue.state}]
        </Text>
      </Box>

      <ScrollView maxVisible={20}>
        {/* Metadata */}
        <Box flexDirection="column" paddingX={2} paddingY={1} key="meta">
          <Box flexDirection="row" gap={4}>
            <Label label="Author" value={issue.author.login} valueColor="cyan" />
            <Label label="Created" value={formatTimeAgo(issue.created_at)} />
          </Box>
          <Box gap={1}>
            <Text dimColor>Labels:</Text>
            {issue.labels.length > 0 ? (
              issue.labels.map((l) => (
                <Text key={l.name} color={l.color ? undefined : labelColor(l.name)} bold>
                  [{l.name}]
                </Text>
              ))
            ) : (
              <Muted>none</Muted>
            )}
          </Box>
          {issue.assignees.length > 0 && (
            <Box gap={1}>
              <Text dimColor>Assignees:</Text>
              {issue.assignees.map((a) => (
                <Text key={a.login} color="cyan">
                  @{a.login}
                </Text>
              ))}
            </Box>
          )}
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
          <Text>{issue.body || "(no description)"}</Text>
        </Box>

        {/* Separator */}
        <Box key="sep" paddingX={2} paddingY={1}>
          <Text dimColor>
            {"--- Comments (" + comments.length + ") ---"}
          </Text>
        </Box>

        {/* Comments */}
        {comments.map((comment) => (
          <Box
            key={`comment-${comment.id}`}
            flexDirection="column"
            paddingX={2}
            paddingY={0}
            borderStyle="single"
            borderColor="gray"
          >
            <Box gap={2}>
              <Text color="cyan" bold>
                @{comment.commenter}
              </Text>
              <Muted>{formatTimeAgo(comment.created_at)}</Muted>
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
