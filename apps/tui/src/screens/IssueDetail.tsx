import React, { useState } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, Label, Muted, ScrollView, Spinner, StatusBar, ErrorBox } from "../primitives";
import { useIssueDetail } from "../hooks";
import { formatTimeAgo, labelColor, theme, copyToClipboard } from "../utils";

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
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Clipboard support: 'y' copies issue URL
  useInput((input) => {
    if (input === "y" && issue) {
      const url = `https://jjhub.tech/${owner}/${name}/issues/${issueId}`;
      const ok = copyToClipboard(url);
      setCopyFeedback(ok ? "Copied URL!" : "Failed to copy");
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
        <Spinner label={`Loading issue #${issueId}...`} />
      </Box>
    );
  }

  if (error || !issue) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
        <ErrorBox
          title="Issue Error"
          message={error ? error.message : "Issue not found"}
          hint="Press q to go back."
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} gap={1}>
        <Text dimColor>#{issue.number}</Text>
        <Heading>{issue.title}</Heading>
        <Text color={issue.state === "open" ? theme.open : theme.closed} bold>
          [{issue.state}]
        </Text>
        {copyFeedback && (
          <Text color={theme.success} bold>{copyFeedback}</Text>
        )}
      </Box>

      <ScrollView maxVisible={20}>
        {/* Metadata */}
        <Box flexDirection="column" paddingX={2} paddingY={1} key="meta">
          <Box flexDirection="row" gap={4}>
            <Label label="Author" value={issue.author.login} valueColor={theme.info} />
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
                <Text key={a.login} color={theme.info}>
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
          borderColor={theme.border}
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
        {comments.length === 0 && (
          <Box key="no-comments" paddingX={2}>
            <Text dimColor>No comments yet.</Text>
          </Box>
        )}
        {comments.map((comment) => (
          <Box
            key={`comment-${comment.id}`}
            flexDirection="column"
            paddingX={2}
            paddingY={0}
            borderStyle="single"
            borderColor={theme.border}
          >
            <Box gap={2}>
              <Text color={theme.info} bold>
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
          { key: "y", label: "copy URL" },
          { key: "q", label: "back" },
        ]}
        left={`${owner}/${name} #${issueId}`}
      />
    </Box>
  );
}
