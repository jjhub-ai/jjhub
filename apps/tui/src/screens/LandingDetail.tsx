import React from "react";
import { Box, Text, Heading, Label, Muted, ScrollView, StatusBar } from "../primitives";

// Mock data — will be replaced with @jjhub/sdk calls
const MOCK_LR = {
  id: 42,
  title: "Add stacked change support",
  state: "open",
  author: "wcory",
  bookmark: "feat/stacked-changes",
  targetBookmark: "main",
  created: "1 day ago",
  updated: "3 hours ago",
  description: `This LR adds full support for stacked changes in the landing queue.

When multiple changes are stacked on top of each other, the landing queue
will process them in dependency order, rebasing as needed.

## Changes

1. **Add change dependency graph** - Parse jj op log to build the dependency DAG
2. **Landing queue rebase** - Rebase dependent changes after a parent lands
3. **UI indicators** - Show stack depth and position in the web UI`,
  changes: [
    { changeId: "kxyzpqr", description: "Add change dependency graph parser", files: 4, insertions: 187, deletions: 12 },
    { changeId: "mwvutsr", description: "Implement landing queue rebase for stacks", files: 6, insertions: 342, deletions: 45 },
    { changeId: "nqponml", description: "Add stack indicators to landing request API", files: 3, insertions: 89, deletions: 8 },
  ],
  checks: [
    { name: "build", status: "pass" },
    { name: "test", status: "pass" },
    { name: "lint", status: "pass" },
    { name: "e2e", status: "running" },
  ],
  reviewers: [
    { user: "smithers", status: "approved" },
  ],
};

function checkColor(status: string): string {
  switch (status) {
    case "pass":
      return "green";
    case "fail":
      return "red";
    case "running":
      return "yellow";
    default:
      return "gray";
  }
}

function checkIcon(status: string): string {
  switch (status) {
    case "pass":
      return "\u2714";
    case "fail":
      return "\u2718";
    case "running":
      return "\u25CB";
    default:
      return "?";
  }
}

export interface LandingDetailProps {
  owner: string;
  name: string;
  lrId: string;
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function LandingDetail({ owner, name, lrId, onNavigate }: LandingDetailProps) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} gap={1}>
        <Text color="gray">!{lrId}</Text>
        <Heading>{MOCK_LR.title}</Heading>
        <Text color={MOCK_LR.state === "open" ? "green" : "cyan"} bold>
          [{MOCK_LR.state}]
        </Text>
      </Box>

      <ScrollView maxVisible={20}>
        {/* Metadata */}
        <Box key="meta" flexDirection="column" paddingX={2} paddingY={1}>
          <Box flexDirection="row" gap={4}>
            <Label label="Author" value={MOCK_LR.author} valueColor="cyan" />
            <Label label="Created" value={MOCK_LR.created} />
            <Label label="Updated" value={MOCK_LR.updated} />
          </Box>
          <Box flexDirection="row" gap={4}>
            <Label label="Source" value={MOCK_LR.bookmark} valueColor="green" />
            <Label label="Target" value={MOCK_LR.targetBookmark} valueColor="yellow" />
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
          <Text>{MOCK_LR.description}</Text>
        </Box>

        {/* Changes (stacked) */}
        <Box key="changes-header" paddingX={2} paddingY={1}>
          <Text bold>Changes ({MOCK_LR.changes.length} stacked)</Text>
        </Box>
        {MOCK_LR.changes.map((change, i) => (
          <Box
            key={`change-${i}`}
            flexDirection="column"
            paddingX={3}
          >
            <Box gap={1}>
              <Text color="magenta" bold>
                {change.changeId}
              </Text>
              <Text>{change.description}</Text>
            </Box>
            <Box paddingLeft={1}>
              <Muted>
                {change.files} files | +{change.insertions} -{change.deletions}
              </Muted>
            </Box>
          </Box>
        ))}

        {/* Checks */}
        <Box key="checks-header" paddingX={2} paddingY={1}>
          <Text bold>Checks</Text>
        </Box>
        {MOCK_LR.checks.map((check) => (
          <Box key={check.name} paddingX={3} gap={1}>
            <Text color={checkColor(check.status)}>
              {checkIcon(check.status)}
            </Text>
            <Text>{check.name}</Text>
            <Text color={checkColor(check.status)}>{check.status}</Text>
          </Box>
        ))}

        {/* Reviewers */}
        <Box key="reviewers-header" paddingX={2} paddingY={1}>
          <Text bold>Reviewers</Text>
        </Box>
        {MOCK_LR.reviewers.map((r) => (
          <Box key={r.user} paddingX={3} gap={1}>
            <Text color={r.status === "approved" ? "green" : "yellow"}>
              {r.status === "approved" ? "\u2714" : "\u25CB"}
            </Text>
            <Text color="cyan">@{r.user}</Text>
            <Text color={r.status === "approved" ? "green" : "yellow"}>
              {r.status}
            </Text>
          </Box>
        ))}
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
