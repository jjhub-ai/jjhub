import React, { useState } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, Label, Muted, ScrollView, Spinner, StatusBar } from "../primitives";
import { useWorkspaceDetail, useWorkspaces, type WorkspaceService } from "../hooks";

function statusColor(status: string): string {
  switch (status) {
    case "running":
      return "green";
    case "suspended":
    case "creating":
      return "yellow";
    case "failed":
    case "deleting":
      return "red";
    default:
      return "gray";
  }
}

function serviceStatusColor(status: string): string {
  switch (status) {
    case "running":
      return "green";
    case "stopped":
      return "gray";
    case "error":
      return "red";
    default:
      return "gray";
  }
}

function serviceStatusDot(status: string): string {
  switch (status) {
    case "running":
      return "\u25CF";
    case "stopped":
      return "\u25CB";
    case "error":
      return "\u2718";
    default:
      return "\u25CB";
  }
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

function formatTimestamp(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

export interface WorkspaceDetailProps {
  owner: string;
  name: string;
  workspaceId: string;
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function WorkspaceDetail({ owner, name, workspaceId, onNavigate }: WorkspaceDetailProps) {
  const { workspace, loading, error, refetch } = useWorkspaceDetail(
    { owner, repo: name },
    workspaceId,
  );
  const { suspend, resume } = useWorkspaces({ owner, repo: name });
  const [actionError, setActionError] = useState<string | null>(null);

  useInput((input) => {
    if (!workspace) return;
    setActionError(null);

    if (input === "s" && workspace.status === "running") {
      suspend(workspace.id)
        .then(() => refetch())
        .catch((err) =>
          setActionError(err instanceof Error ? err.message : String(err)),
        );
      return;
    }

    if (input === "r" && workspace.status === "suspended") {
      resume(workspace.id)
        .then(() => refetch())
        .catch((err) =>
          setActionError(err instanceof Error ? err.message : String(err)),
        );
      return;
    }

    if (input === "l") {
      onNavigate("workspace-logs", {
        owner,
        name,
        workspaceId: workspace.id,
      });
      return;
    }

    if (input === "R") {
      refetch();
      return;
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
        <Spinner label="Loading workspace..." />
      </Box>
    );
  }

  if (error || !workspace) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
        <Text color="red">
          {error ? `Error: ${error.message}` : "Workspace not found"}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} gap={1}>
        <Heading>{workspace.name}</Heading>
        <Text color={statusColor(workspace.status)} bold>
          [{workspace.status}]
        </Text>
      </Box>

      <ScrollView maxVisible={20}>
        {/* Workspace info */}
        <Box key="info" flexDirection="column" paddingX={2} paddingY={1}>
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={statusColor(workspace.status)}
            padding={1}
          >
            <Text bold>Workspace Info</Text>
            <Box flexDirection="row" gap={4} marginTop={1}>
              <Label label="Status" value={workspace.status} valueColor={statusColor(workspace.status)} />
              <Label label="Bookmark" value={workspace.bookmark} valueColor="cyan" />
            </Box>
            <Box flexDirection="row" gap={4}>
              <Label label="Created" value={formatTimestamp(workspace.created_at)} />
              <Label label="Last activity" value={formatTimeAgo(workspace.last_activity)} />
            </Box>
            {workspace.ssh_url && (
              <Box gap={1} marginTop={1}>
                <Text dimColor>SSH:</Text>
                <Text color="cyan">{workspace.ssh_url}</Text>
              </Box>
            )}
          </Box>
        </Box>

        {actionError && (
          <Box key="action-error" paddingX={2}>
            <Text color="red">Error: {actionError}</Text>
          </Box>
        )}

        {/* Services */}
        <Box key="services-header" paddingX={2} paddingY={1}>
          <Text bold>Services ({workspace.services.length})</Text>
        </Box>

        {workspace.services.length === 0 ? (
          <Box key="no-services" paddingX={3}>
            <Muted>No services configured</Muted>
          </Box>
        ) : (
          workspace.services.map((svc: WorkspaceService) => (
            <Box
              key={`svc-${svc.name}`}
              flexDirection="row"
              paddingX={3}
              gap={1}
            >
              <Text color={serviceStatusColor(svc.status)}>
                {serviceStatusDot(svc.status)}
              </Text>
              <Text bold>{svc.name}</Text>
              <Text color={serviceStatusColor(svc.status)}>
                {svc.status}
              </Text>
              {svc.port && <Muted>:{svc.port}</Muted>}
            </Box>
          ))
        )}
      </ScrollView>

      <StatusBar
        bindings={[
          { key: "j/k", label: "scroll" },
          { key: "s", label: "suspend" },
          { key: "r", label: "resume" },
          { key: "l", label: "logs" },
          { key: "R", label: "refresh" },
          { key: "q", label: "back" },
        ]}
        left={`${owner}/${name} / ${workspace.name}`}
      />
    </Box>
  );
}
