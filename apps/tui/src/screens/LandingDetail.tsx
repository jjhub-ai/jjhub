import React from "react";
import { Box, Text, Heading, Label, Muted, ScrollView, Spinner, StatusBar } from "../primitives";
import { useLandingDetail } from "../hooks";

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

  if (loading) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
        <Spinner label="Loading landing request..." />
      </Box>
    );
  }

  if (error || !landing) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
        <Text color="red">
          {error ? `Error: ${error.message}` : "Landing request not found"}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} gap={1}>
        <Text color="gray">!{landing.number}</Text>
        <Heading>{landing.title}</Heading>
        <Text color={landing.state === "open" ? "green" : landing.state === "merged" ? "cyan" : "red"} bold>
          [{landing.state}]
        </Text>
      </Box>

      <ScrollView maxVisible={20}>
        {/* Metadata */}
        <Box key="meta" flexDirection="column" paddingX={2} paddingY={1}>
          <Box flexDirection="row" gap={4}>
            <Label label="Author" value={landing.author.login} valueColor="cyan" />
            <Label label="Created" value={formatTimeAgo(landing.created_at)} />
            <Label label="Updated" value={formatTimeAgo(landing.updated_at)} />
          </Box>
          <Box flexDirection="row" gap={4}>
            <Label label="Target" value={landing.target_bookmark} valueColor="yellow" />
            <Label label="Conflict" value={landing.conflict_status} valueColor={landing.conflict_status === "clean" ? "green" : "red"} />
          </Box>
        </Box>

        {/* Description */}
        <Box
          key="desc"
          flexDirection="column"
          paddingX={2}
          borderStyle="single"
          borderColor="gray"
        >
          <Text bold>Description</Text>
          <Text>{landing.body || "(no description)"}</Text>
        </Box>

        {/* Changes (stacked) */}
        <Box key="changes-header" paddingX={2} paddingY={1}>
          <Text bold>Changes ({landing.stack_size} stacked)</Text>
        </Box>
        {changes.map((change) => (
          <Box
            key={`change-${change.id}`}
            flexDirection="column"
            paddingX={3}
          >
            <Box gap={1}>
              <Text color="magenta" bold>
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
                <Text color="magenta" bold>{cid}</Text>
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
                <Text color={r.type === "approve" ? "green" : r.type === "request_changes" ? "red" : "yellow"}>
                  {r.type === "approve" ? "\u2714" : r.type === "request_changes" ? "\u2718" : "\u25CB"}
                </Text>
                <Text color="cyan">@{r.reviewer.login}</Text>
                <Text color={r.type === "approve" ? "green" : r.type === "request_changes" ? "red" : "yellow"}>
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
                borderColor="gray"
              >
                <Box gap={2}>
                  <Text color="cyan" bold>
                    @{comment.author.login}
                  </Text>
                  <Muted>{formatTimeAgo(comment.created_at)}</Muted>
                </Box>
                <Text>{comment.body}</Text>
              </Box>
            ))}
          </>
        )}
      </ScrollView>

      <StatusBar
        bindings={[
          { key: "j/k", label: "scroll" },
          { key: "q", label: "back" },
        ]}
        left={`${owner}/${name} !${lrId}`}
      />
    </Box>
  );
}
