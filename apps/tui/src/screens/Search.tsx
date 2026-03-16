import React, { useState } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, Input, List, StatusBar, type ListItem } from "../primitives";

type SearchType = "repos" | "issues" | "landings" | "changes" | "all";

// Mock search results — will be replaced with @jjhub/sdk SearchService
const MOCK_RESULTS: Record<SearchType, ListItem[]> = {
  repos: [
    { key: "repo:jjhub-ai/jjhub", label: "jjhub-ai/jjhub", description: "jj-native code hosting platform", badge: { text: "repo", color: "blue" } },
    { key: "repo:jjhub-ai/smithers", label: "jjhub-ai/smithers", description: "AI workflow orchestration", badge: { text: "repo", color: "blue" } },
  ],
  issues: [
    { key: "issue:145", label: "#145 Fix SSH key rotation", description: "jjhub-ai/jjhub", badge: { text: "issue", color: "green" } },
    { key: "issue:139", label: "#139 Workflow runner timeout", description: "jjhub-ai/jjhub", badge: { text: "issue", color: "green" } },
  ],
  landings: [
    { key: "lr:42", label: "!42 Add stacked change support", description: "jjhub-ai/jjhub", badge: { text: "LR", color: "magenta" } },
  ],
  changes: [
    { key: "change:kxyzpqr", label: "kxyzpqr Add change dependency graph", description: "jjhub-ai/jjhub", badge: { text: "change", color: "cyan" } },
  ],
  all: [],
};

// Combine all results for "all" filter
MOCK_RESULTS.all = [
  ...MOCK_RESULTS.repos,
  ...MOCK_RESULTS.issues,
  ...MOCK_RESULTS.landings,
  ...MOCK_RESULTS.changes,
];

export interface SearchProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function Search({ onNavigate }: SearchProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<SearchType>("all");
  const [isInputMode, setIsInputMode] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);

  const results = hasSearched ? MOCK_RESULTS[typeFilter] : [];

  useInput(
    (input, key) => {
      if (isInputMode) return; // Input component handles keys

      if (input === "/") {
        setIsInputMode(true);
        return;
      }

      // Type filter shortcuts (when not in input mode)
      if (input === "1") setTypeFilter("all");
      if (input === "2") setTypeFilter("repos");
      if (input === "3") setTypeFilter("issues");
      if (input === "4") setTypeFilter("landings");
      if (input === "5") setTypeFilter("changes");
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
          placeholder="Search repositories, issues, landing requests, changes..."
          prompt="/ "
          active={isInputMode}
          onSubmit={() => {
            setHasSearched(true);
            setIsInputMode(false);
          }}
          onCancel={() => {
            setIsInputMode(false);
          }}
        />
      </Box>

      {/* Type filter tabs */}
      <Box paddingX={1} gap={2}>
        {(
          [
            { key: "all", label: "All (1)" },
            { key: "repos", label: "Repos (2)" },
            { key: "issues", label: "Issues (3)" },
            { key: "landings", label: "LRs (4)" },
            { key: "changes", label: "Changes (5)" },
          ] as const
        ).map((t) => (
          <Text
            key={t.key}
            bold={typeFilter === t.key}
            color={typeFilter === t.key ? "cyan" : "gray"}
          >
            {t.label}
          </Text>
        ))}
      </Box>

      {/* Results */}
      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
        {!hasSearched ? (
          <Text dimColor>Type a query and press Enter to search</Text>
        ) : results.length === 0 ? (
          <Text dimColor>No results for "{query}"</Text>
        ) : (
          <List
            items={results}
            active={!isInputMode}
            onSelect={(item) => {
              const [type, id] = item.key.split(":");
              switch (type) {
                case "repo": {
                  const [owner, name] = id!.split("/");
                  onNavigate("repo", { owner: owner!, name: name! });
                  break;
                }
                case "issue":
                  onNavigate("issue-detail", {
                    owner: "jjhub-ai",
                    name: "jjhub",
                    issueId: id!,
                  });
                  break;
                case "lr":
                  onNavigate("landing-detail", {
                    owner: "jjhub-ai",
                    name: "jjhub",
                    lrId: id!,
                  });
                  break;
              }
            }}
          />
        )}
      </Box>

      <StatusBar
        bindings={[
          { key: "/", label: "search" },
          { key: "1-5", label: "filter type" },
          { key: "j/k", label: "navigate" },
          { key: "Enter", label: "open" },
          { key: "q", label: "back" },
        ]}
        left={hasSearched ? `${results.length} results` : undefined}
      />
    </Box>
  );
}
