import React, { useState } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, Label, Muted, ScrollView, Spinner, StatusBar, ErrorBox } from "../primitives";
import { useWorkspaceDetail, useWorkspaces, type WorkspaceService } from "../hooks";
import { formatTimeAgo, formatTimestamp, statusColor, theme } from "../utils";

function serviceStatusDot(status: string): string {
  switch (status) {
    case "running": return "\u25CF";
    case "stopped": return "\u25CB";
    case "error": return "\u2718";
    default: return "\u25CB";
  }
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
        <Spinner label="Loading workspace details..." />
      </Box>
    );
  }

  if (error || !workspace) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
        <ErrorBox
          title="Workspace Error"
          message={error ? error.message : "Workspace not found"}
          hint="Press q to go back."
        />
      </Box>
    );
  }

  const wsColor = statusColor(workspace.status);

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} gap={1}>
        <Heading>{workspace.name}</Heading>
        <Text color={wsColor} bold>
          [{workspace.status}]
        </Text>
      </Box>

      <ScrollView maxVisible={20}>
        {/* Workspace info */}
        <Box key="info" flexDirection="column" paddingX={2} paddingY={1}>
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={wsColor}
            padding={1}
          >
            <Text bold>Workspace Info</Text>
            <Box flexDirection="row" gap={4} marginTop={1}>
              <Label label="Status" value={workspace.status} valueColor={wsColor} />
              <Label label="Bookmark" value={workspace.bookmark} valueColor={theme.info} />
            </Box>
            <Box flexDirection="row" gap={4}>
              <Label label="Created" value={formatTimestamp(workspace.created_at)} />
              <Label label="Last activity" value={formatTimeAgo(workspace.last_activity)} />
            </Box>
            {workspace.ssh_url && (
              <Box gap={1} marginTop={1}>
                <Text dimColor>SSH:</Text>
                <Text color={theme.info}>{workspace.ssh_url}</Text>
              </Box>
            )}
          </Box>
        </Box>

        {actionError && (
          <Box key="action-error" paddingX={2}>
            <ErrorBox message={actionError} />
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
              <Text color={statusColor(svc.status)}>
                {serviceStatusDot(svc.status)}
              </Text>
              <Text bold>{svc.name}</Text>
              <Text color={statusColor(svc.status)}>
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
