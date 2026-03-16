import React, { useState } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, Label, Muted, ScrollView, Spinner, StatusBar, ErrorBox } from "../primitives";
import { useLandingDetail } from "../hooks";
import { formatTimeAgo, theme, copyToClipboard } from "../utils";

export interface LandingDetailProps {
  owner: string;
  name: string;
  lrId: string;
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function LandingDetail({ owner, name, lrId, onNavigate }: LandingDetailProps) {
  const lrNumber = parseInt(lrId, 10);
  const { landing, comments, reviews, changes, loading, error } = useLandingDetail(
    { owner, repo: name },
    lrNumber,
  );
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  useInput((input) => {
    if (input === "d" && !loading && landing) {
      onNavigate("diff", { owner, name, lrNumber: lrId });
    }
    // Clipboard support: 'y' copies LR URL
    if (input === "y" && landing) {
      const url = `https://jjhub.tech/${owner}/${name}/landings/${lrId}`;
      const ok = copyToClipboard(url);
      setCopyFeedback(ok ? "Copied URL!" : "Failed to copy");
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
        <Spinner label={`Loading landing request !${lrId}...`} />
      </Box>
    );
  }

  if (error || !landing) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
        <ErrorBox
          title="Landing Request Error"
          message={error ? error.message : "Landing request not found"}
          hint="Press q to go back."
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} gap={1}>
        <Text dimColor>!{landing.number}</Text>
        <Heading>{landing.title}</Heading>
        <Text color={landing.state === "open" ? theme.open : landing.state === "merged" ? theme.merged : theme.closed} bold>
          [{landing.state}]
        </Text>
        {copyFeedback && (
          <Text color={theme.success} bold>{copyFeedback}</Text>
        )}
      </Box>

      <ScrollView maxVisible={20}>
        {/* Metadata */}
        <Box key="meta" flexDirection="column" paddingX={2} paddingY={1}>
          <Box flexDirection="row" gap={4}>
            <Label label="Author" value={landing.author.login} valueColor={theme.info} />
            <Label label="Created" value={formatTimeAgo(landing.created_at)} />
            <Label label="Updated" value={formatTimeAgo(landing.updated_at)} />
          </Box>
          <Box flexDirection="row" gap={4}>
            <Label label="Target" value={landing.target_bookmark} valueColor={theme.warning} />
            <Label label="Conflict" value={landing.conflict_status} valueColor={landing.conflict_status === "clean" ? theme.success : theme.error} />
          </Box>
        </Box>

        {/* Description */}
        <Box
          key="desc"
          flexDirection="column"
          paddingX={2}
          borderStyle="single"
          borderColor={theme.border}
        >
          <Text bold>Description</Text>
          <Text>{landing.body || "(no description)"}</Text>
        </Box>

        {/* Changes (stacked) */}
        <Box key="changes-header" paddingX={2} paddingY={1}>
          <Text bold>Changes ({landing.stack_size} stacked)</Text>
        </Box>
        {changes.length === 0 && landing.change_ids.length === 0 && (
          <Box key="no-changes" paddingX={3}>
            <Muted>No changes in this landing request.</Muted>
          </Box>
        )}
        {changes.map((change) => (
          <Box
            key={`change-${change.id}`}
            flexDirection="column"
            paddingX={3}
          >
            <Box gap={1}>
              <Text color={theme.agent} bold>
                {change.change_id}
              </Text>
              <Muted>position {change.position_in_stack}</Muted>
            </Box>
          </Box>
        ))}
        {changes.length === 0 && landing.change_ids.length > 0 && (
          <>
            {landing.change_ids.map((cid) => (
              <Box key={cid} paddingX={3}>
                <Text color={theme.agent} bold>{cid}</Text>
              </Box>
            ))}
          </>
        )}

        {/* Reviewers */}
        {reviews.length > 0 && (
          <>
            <Box key="reviewers-header" paddingX={2} paddingY={1}>
              <Text bold>Reviews</Text>
            </Box>
            {reviews.map((r) => (
              <Box key={r.id} paddingX={3} gap={1}>
                <Text color={r.type === "approve" ? theme.success : r.type === "request_changes" ? theme.error : theme.warning}>
                  {r.type === "approve" ? "\u2714" : r.type === "request_changes" ? "\u2718" : "\u25CB"}
                </Text>
                <Text color={theme.info}>@{r.reviewer.login}</Text>
                <Text color={r.type === "approve" ? theme.success : r.type === "request_changes" ? theme.error : theme.warning}>
                  {r.type}
                </Text>
              </Box>
            ))}
          </>
        )}

        {/* Comments */}
        {comments.length > 0 && (
          <>
            <Box key="comments-header" paddingX={2} paddingY={1}>
              <Text dimColor>
                {"--- Comments (" + comments.length + ") ---"}
              </Text>
            </Box>
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
                    @{comment.author.login}
                  </Text>
                  <Muted>{formatTimeAgo(comment.created_at)}</Muted>
                </Box>
                <Text>{comment.body}</Text>
              </Box>
            ))}
          </>
        )}
        {comments.length === 0 && (
          <Box key="no-comments" paddingX={2} paddingY={1}>
            <Muted>No comments yet.</Muted>
          </Box>
        )}
      </ScrollView>

      <StatusBar
        bindings={[
          { key: "j/k", label: "scroll" },
          { key: "d", label: "diff" },
          { key: "y", label: "copy URL" },
          { key: "q", label: "back" },
        ]}
        left={`${owner}/${name} !${lrId}`}
      />
    </Box>
  );
}
