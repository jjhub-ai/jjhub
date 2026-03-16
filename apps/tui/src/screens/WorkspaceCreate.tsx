import React, { useState, useEffect, useMemo } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, Muted, Spinner, StatusBar } from "../primitives";
import { repoApiFetch } from "@jjhub/ui-core";
import type { BookmarkResponse, RepoContext } from "@jjhub/ui-core";
import { useWorkspaces } from "../hooks";

type CreatePhase = "select-bookmark" | "confirm" | "creating" | "done" | "error";

export interface WorkspaceCreateProps {
  owner: string;
  name: string;
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function WorkspaceCreate({ owner, name, onNavigate }: WorkspaceCreateProps) {
  const context: RepoContext = { owner, repo: name };
  const { create } = useWorkspaces(context);

  const [phase, setPhase] = useState<CreatePhase>("select-bookmark");
  const [bookmarks, setBookmarks] = useState<BookmarkResponse[]>([]);
  const [bookmarksLoading, setBookmarksLoading] = useState(true);
  const [bookmarksError, setBookmarksError] = useState<Error | undefined>(undefined);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [createError, setCreateError] = useState<string | null>(null);

  // Fetch bookmarks
  useEffect(() => {
    let cancelled = false;
    setBookmarksLoading(true);

    repoApiFetch("/bookmarks?per_page=100", {}, context)
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          throw new Error(`Failed to load bookmarks (${response.status})`);
        }
        const body = await response.json();
        setBookmarks(Array.isArray(body) ? (body as BookmarkResponse[]) : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setBookmarksError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setBookmarksLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [owner, name]);

  const selectedBookmark = bookmarks[selectedIndex];

  useInput((input, key) => {
    if (phase === "select-bookmark") {
      if (input === "j" || key.downArrow) {
        setSelectedIndex((i) => Math.min(i + 1, bookmarks.length - 1));
        return;
      }
      if (input === "k" || key.upArrow) {
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (key.return && selectedBookmark) {
        setPhase("confirm");
        return;
      }
    }

    if (phase === "confirm") {
      if (input === "y" && selectedBookmark) {
        setPhase("creating");
        create(selectedBookmark.name)
          .then(() => setPhase("done"))
          .catch((err) => {
            setCreateError(err instanceof Error ? err.message : String(err));
            setPhase("error");
          });
        return;
      }
      if (input === "n" || key.escape) {
        setPhase("select-bookmark");
        return;
      }
    }

    if (phase === "done") {
      if (key.return || input === "q") {
        onNavigate("workspaces", { owner, name });
        return;
      }
    }

    if (phase === "error") {
      if (key.return || input === "q") {
        setPhase("select-bookmark");
        setCreateError(null);
        return;
      }
    }
  });

  // Bookmark selection phase
  if (phase === "select-bookmark") {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Box paddingX={1}>
          <Heading>
            Create Workspace - {owner}/{name}
          </Heading>
        </Box>

        <Box paddingX={1} paddingY={1}>
          <Text bold>Select a bookmark:</Text>
        </Box>

        <Box flexDirection="column" flexGrow={1} paddingX={1}>
          {bookmarksLoading ? (
            <Spinner label="Loading bookmarks..." />
          ) : bookmarksError ? (
            <Text color="red">Error: {bookmarksError.message}</Text>
          ) : bookmarks.length === 0 ? (
            <Muted>No bookmarks found</Muted>
          ) : (
            bookmarks.map((bm, i) => (
              <Box key={bm.name} gap={1}>
                <Text color={i === selectedIndex ? "cyan" : "white"} bold={i === selectedIndex}>
                  {i === selectedIndex ? "\u25B6" : " "}
                </Text>
                <Text color={i === selectedIndex ? "cyan" : "white"} bold={i === selectedIndex}>
                  {bm.name}
                </Text>
                <Muted>{bm.target_change_id.slice(0, 12)}</Muted>
              </Box>
            ))
          )}
        </Box>

        <StatusBar
          bindings={[
            { key: "j/k", label: "select" },
            { key: "Enter", label: "confirm" },
            { key: "q", label: "back" },
          ]}
          left={`${bookmarks.length} bookmarks`}
        />
      </Box>
    );
  }

  // Confirmation phase
  if (phase === "confirm") {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Box paddingX={1}>
          <Heading>Create Workspace</Heading>
        </Box>

        <Box flexDirection="column" paddingX={2} paddingY={2} gap={1}>
          <Text>Create a new workspace from bookmark:</Text>
          <Box gap={1}>
            <Text dimColor>Bookmark:</Text>
            <Text color="cyan" bold>
              {selectedBookmark?.name}
            </Text>
          </Box>
          <Box gap={1}>
            <Text dimColor>Change:</Text>
            <Text color="magenta">{selectedBookmark?.target_change_id.slice(0, 12)}</Text>
          </Box>
          <Box marginTop={1} gap={1}>
            <Text>Continue?</Text>
            <Text color="green" bold>[y]es</Text>
            <Text dimColor>/</Text>
            <Text color="red" bold>[n]o</Text>
          </Box>
        </Box>

        <StatusBar
          bindings={[
            { key: "y", label: "create" },
            { key: "n", label: "cancel" },
          ]}
        />
      </Box>
    );
  }

  // Creating phase
  if (phase === "creating") {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Box paddingX={1}>
          <Heading>Create Workspace</Heading>
        </Box>

        <Box paddingX={2} paddingY={2} flexDirection="column" gap={1}>
          <Spinner label={`Creating workspace from ${selectedBookmark?.name}...`} />
          <Muted>This may take a moment</Muted>
        </Box>
      </Box>
    );
  }

  // Done phase
  if (phase === "done") {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Box paddingX={1}>
          <Heading>Create Workspace</Heading>
        </Box>

        <Box paddingX={2} paddingY={2} flexDirection="column" gap={1}>
          <Text color="green" bold>
            Workspace created successfully!
          </Text>
          <Box gap={1}>
            <Text dimColor>Bookmark:</Text>
            <Text color="cyan">{selectedBookmark?.name}</Text>
          </Box>
          <Muted>Press Enter or q to return to workspace list</Muted>
        </Box>

        <StatusBar
          bindings={[
            { key: "Enter", label: "done" },
            { key: "q", label: "back" },
          ]}
        />
      </Box>
    );
  }

  // Error phase
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1}>
        <Heading>Create Workspace</Heading>
      </Box>

      <Box paddingX={2} paddingY={2} flexDirection="column" gap={1}>
        <Text color="red" bold>
          Failed to create workspace
        </Text>
        <Text color="red">{createError}</Text>
        <Muted>Press Enter or q to try again</Muted>
      </Box>

      <StatusBar
        bindings={[
          { key: "Enter", label: "retry" },
          { key: "q", label: "back" },
        ]}
      />
    </Box>
  );
}
