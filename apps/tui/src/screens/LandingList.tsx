import React, { useState, useMemo } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, List, Spinner, StatusBar, type ListItem } from "../primitives";
import { useLandings } from "../hooks";

type LRState = "open" | "merged" | "closed" | "all";

function stateColor(state: string): string {
  switch (state) {
    case "open":
      return "green";
    case "merged":
      return "cyan";
    case "closed":
      return "red";
    case "draft":
      return "gray";
    default:
      return "white";
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
        badge: { text: lr.state, color: stateColor(lr.state) },
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
        <Heading>
          Landing Requests - {owner}/{name}
        </Heading>
        <Box gap={1}>
          {(["open", "merged", "closed", "all"] as const).map((f) => (
            <Text
              key={f}
              bold={filter === f}
              color={filter === f ? "cyan" : "gray"}
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
          <Text color="red">Error: {error.message}</Text>
        ) : (
          <List
            items={items}
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
