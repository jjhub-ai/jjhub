import React, { useState, useMemo } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, Input, List, Spinner, StatusBar, type ListItem } from "../primitives";
import { useSearch } from "../hooks";

// Commands available in the palette when user types "/"
const PALETTE_COMMANDS: { key: string; label: string; description: string }[] = [
  { key: "/agent", label: "/agent", description: "Open agent session list" },
  { key: "/agent new", label: "/agent new", description: "Start a new agent session" },
  { key: "/agent chat", label: "/agent chat", description: "Open agent chat (most recent session)" },
];

export interface SearchProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function Search({ onNavigate }: SearchProps) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [isInputMode, setIsInputMode] = useState(true);

  const { results, loading, error } = useSearch(submittedQuery);

  const isCommandMode = query.startsWith("/");

  // Filter palette commands based on current input
  const commandItems: ListItem[] = useMemo(() => {
    if (!isCommandMode) return [];
    const q = query.toLowerCase();
    return PALETTE_COMMANDS.filter(
      (cmd) => cmd.key.startsWith(q) || cmd.label.toLowerCase().includes(q),
    ).map((cmd) => ({
      key: cmd.key,
      label: cmd.label,
      description: cmd.description,
      badge: { text: "command", color: "magenta" },
    }));
  }, [query, isCommandMode]);

  const searchItems: ListItem[] = useMemo(() => {
    if (!results) return [];
    return results.map((repo) => ({
      key: `${repo.owner}/${repo.name}`,
      label: repo.full_name,
      description: repo.description || "",
      badge: { text: "repo", color: "blue" },
    }));
  }, [results]);

  const handleCommandSelect = (item: ListItem) => {
    switch (item.key) {
      case "/agent":
        // Navigate to agent sessions for the most recent repo context,
        // or prompt user to navigate to a repo first
        onNavigate("agent-sessions", {});
        break;
      case "/agent new":
        onNavigate("agent-chat", { mode: "new" });
        break;
      case "/agent chat":
        onNavigate("agent-chat", {});
        break;
    }
  };

  useInput(
    (input, key) => {
      if (isInputMode) return;

      if (input === "/") {
        setIsInputMode(true);
        return;
      }
    },
    { isActive: !isInputMode },
  );

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1}>
        <Heading>{isCommandMode ? "Command Palette" : "Search"}</Heading>
      </Box>

      {/* Search input */}
      <Box paddingX={1} paddingY={1}>
        <Input
          value={query}
          onChange={setQuery}
          placeholder="Search repositories or type / for commands..."
          prompt="/ "
          active={isInputMode}
          onSubmit={() => {
            if (isCommandMode) {
              // Try to match exactly
              const match = PALETTE_COMMANDS.find(
                (cmd) => cmd.key === query.toLowerCase().trim(),
              );
              if (match) {
                handleCommandSelect({ key: match.key, label: match.label });
              } else {
                setIsInputMode(false);
              }
            } else {
              setSubmittedQuery(query);
              setIsInputMode(false);
            }
          }}
          onCancel={() => {
            setIsInputMode(false);
          }}
        />
      </Box>

      {/* Results */}
      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
        {isCommandMode ? (
          commandItems.length === 0 ? (
            <Text dimColor>No matching commands</Text>
          ) : (
            <List
              items={commandItems}
              active={!isInputMode}
              onSelect={handleCommandSelect}
            />
          )
        ) : !submittedQuery ? (
          <Text dimColor>Type a query and press Enter to search</Text>
        ) : loading ? (
          <Spinner label="Searching..." />
        ) : error ? (
          <Text color="red">Error: {error.message}</Text>
        ) : searchItems.length === 0 ? (
          <Text dimColor>No results for "{submittedQuery}"</Text>
        ) : (
          <List
            items={searchItems}
            active={!isInputMode}
            onSelect={(item) => {
              const parts = item.key.split("/");
              if (parts.length === 2) {
                onNavigate("repo", { owner: parts[0]!, name: parts[1]! });
              }
            }}
          />
        )}
      </Box>

      <StatusBar
        bindings={[
          { key: "/", label: "search" },
          { key: "j/k", label: "navigate" },
          { key: "Enter", label: isCommandMode ? "run" : "open" },
          { key: "q", label: "back" },
        ]}
        left={
          isCommandMode
            ? `${commandItems.length} commands`
            : submittedQuery && results
              ? `${results.length} results`
              : undefined
        }
      />
    </Box>
  );
}
