import React, { useState, useMemo } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, List, Spinner, StatusBar, ErrorBox, type ListItem } from "../primitives";
import { useLandings } from "../hooks";
import { formatTimeAgo, lrStateColor, theme } from "../utils";

type LRState = "open" | "merged" | "closed" | "all";

export interface LandingListProps {
  owner: string;
  name: string;
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

export function LandingList({ owner, name, onNavigate }: LandingListProps) {
  const [filter, setFilter] = useState<LRState>("open");
  const { landings, loading, error } = useLandings({ owner, repo: name });

  const filtered = useMemo(() => {
    if (!landings) return [];
    return landings.filter((lr) => {
      if (filter === "all") return true;
      return lr.state === filter;
    });
  }, [landings, filter]);

  const items: ListItem[] = useMemo(
    () =>
      filtered.map((lr) => ({
        key: String(lr.number),
        label: `!${lr.number} ${lr.title}`,
        description: `${lr.target_bookmark} (${lr.stack_size} changes) by ${lr.author.login} ${formatTimeAgo(lr.created_at)}`,
        badge: { text: lr.state, color: lrStateColor(lr.state) },
      })),
    [filtered],
  );

  useInput((input) => {
    if (input === "o") setFilter("open");
    if (input === "m") setFilter("merged");
    if (input === "c") setFilter("closed");
    if (input === "a") setFilter("all");
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} gap={2}>
        <Heading>Landing Requests</Heading>
        <Box gap={1}>
          {(["open", "merged", "closed", "all"] as const).map((f) => (
            <Text
              key={f}
              bold={filter === f}
              color={filter === f ? theme.accent : theme.muted}
            >
              [{f}]
            </Text>
          ))}
        </Box>
      </Box>

      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {loading ? (
          <Spinner label="Loading landing requests..." />
        ) : error ? (
          <ErrorBox message={error.message} hint="Press q to go back." />
        ) : (
          <List
            items={items}
            emptyMessage={`No ${filter === "all" ? "" : filter + " "}landing requests found.`}
            emptyHint="Create a landing request from the CLI with 'jjhub lr create'."
            onSelect={(item) => {
              onNavigate("landing-detail", {
                owner,
                name,
                lrId: item.key,
              });
            }}
          />
        )}
      </Box>

      <StatusBar
        bindings={[
          { key: "j/k", label: "navigate" },
          { key: "Enter", label: "view" },
          { key: "o", label: "open" },
          { key: "m", label: "merged" },
          { key: "c", label: "closed" },
          { key: "a", label: "all" },
          { key: "q", label: "back" },
        ]}
        left={`${filtered.length} landing requests`}
      />
    </Box>
  );
}
