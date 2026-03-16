import React, { useState, useCallback } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, Muted, Input, Spinner, StatusBar } from "../primitives";

export interface IssueCreateProps {
  owner: string;
  name: string;
  initialTitle?: string;
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

type FocusField = "title" | "body";

export function IssueCreate({ owner, name, initialTitle, onNavigate }: IssueCreateProps) {
  const [title, setTitle] = useState(initialTitle ?? "");
  const [body, setBody] = useState("");
  const [focus, setFocus] = useState<FocusField>("title");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { repoApiFetch } = await import("@jjhub/ui-core");
      const response = await repoApiFetch(
        "/issues",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            body: body.trim() || undefined,
          }),
        },
        { owner, repo: name },
      );

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(
          errBody?.message ?? `Failed to create issue (${response.status})`,
        );
      }

      const created = await response.json();
      setSuccess(true);

      // Navigate to the created issue after a brief pause
      setTimeout(() => {
        onNavigate("issue-detail", {
          owner,
          name,
          issueId: String(created.number ?? created.id),
        });
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [title, body, owner, name, onNavigate]);

  // Global keybindings for the form
  useInput(
    (input, key) => {
      // Ctrl+Enter submits
      if (key.return && key.ctrl) {
        handleSubmit();
        return;
      }

      // Tab switches between fields
      if (key.tab) {
        setFocus((f) => (f === "title" ? "body" : "title"));
        return;
      }
    },
    { isActive: !submitting && !success },
  );

  if (success) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
        <Box gap={1}>
          <Text color="green" bold>Issue created successfully!</Text>
        </Box>
        <Muted>Redirecting to issue...</Muted>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1}>
        <Heading>
          New Issue - {owner}/{name}
        </Heading>
      </Box>

      {error && (
        <Box paddingX={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {/* Title field */}
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        <Box gap={1}>
          <Text bold color={focus === "title" ? "cyan" : "white"}>
            Title
          </Text>
          <Text color="red">*</Text>
          {focus === "title" && <Text dimColor>(editing)</Text>}
        </Box>
        <Input
          value={title}
          onChange={setTitle}
          placeholder="Issue title..."
          prompt={focus === "title" ? "> " : "  "}
          active={focus === "title" && !submitting}
          onCancel={() => onNavigate("__back__")}
        />
      </Box>

      {/* Body field */}
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        <Box gap={1}>
          <Text bold color={focus === "body" ? "cyan" : "white"}>
            Description
          </Text>
          <Muted>(optional)</Muted>
          {focus === "body" && <Text dimColor>(editing)</Text>}
        </Box>
        <Input
          value={body}
          onChange={setBody}
          placeholder="Describe the issue..."
          prompt={focus === "body" ? "> " : "  "}
          active={focus === "body" && !submitting}
          onCancel={() => setFocus("title")}
        />
      </Box>

      {/* Preview */}
      {(title || body) && (
        <Box
          flexDirection="column"
          paddingX={1}
          paddingY={1}
          borderStyle="single"
          borderColor="gray"
        >
          <Text bold dimColor>Preview</Text>
          <Box paddingX={1}>
            <Text bold>{title || "(untitled)"}</Text>
          </Box>
          {body && (
            <Box paddingX={1}>
              <Text>{body}</Text>
            </Box>
          )}
        </Box>
      )}

      {submitting && (
        <Box paddingX={1}>
          <Spinner label="Creating issue..." />
        </Box>
      )}

      <StatusBar
        bindings={[
          { key: "Tab", label: "switch field" },
          { key: "Ctrl+Enter", label: "submit" },
          { key: "Esc", label: "cancel" },
        ]}
        left={`${owner}/${name}`}
      />
    </Box>
  );
}
