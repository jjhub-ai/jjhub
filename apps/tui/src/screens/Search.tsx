import React, { useState, useMemo } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, Input, List, Spinner, StatusBar, type ListItem } from "../primitives";
import { useSearch } from "../hooks";

export interface SearchProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function Search({ onNavigate }: SearchProps) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [isInputMode, setIsInputMode] = useState(true);

  const { results, loading, error } = useSearch(submittedQuery);

  const items: ListItem[] = useMemo(() => {
    if (!results) return [];
    return results.map((repo) => ({
      key: `${repo.owner}/${repo.name}`,
      label: repo.full_name,
      description: repo.description || "",
      badge: { text: "repo", color: "blue" },
    }));
  }, [results]);

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
        <Heading>Search</Heading>
      </Box>

      {/* Search input */}
      <Box paddingX={1} paddingY={1}>
        <Input
          value={query}
          onChange={setQuery}
          placeholder="Search repositories..."
          prompt="/ "
          active={isInputMode}
          onSubmit={() => {
            setSubmittedQuery(query);
            setIsInputMode(false);
          }}
          onCancel={() => {
            setIsInputMode(false);
          }}
        />
      </Box>

      {/* Results */}
      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
        {!submittedQuery ? (
          <Text dimColor>Type a query and press Enter to search</Text>
        ) : loading ? (
          <Spinner label="Searching..." />
        ) : error ? (
          <Text color="red">Error: {error.message}</Text>
        ) : items.length === 0 ? (
          <Text dimColor>No results for "{submittedQuery}"</Text>
        ) : (
          <List
            items={items}
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
          { key: "Enter", label: "open" },
          { key: "q", label: "back" },
        ]}
        left={submittedQuery && results ? `${results.length} results` : undefined}
      />
    </Box>
  );
}
