import React, { useState, useMemo } from "react";
import { Box as InkBox } from "ink";
import { Box, Text, Input, StatusBar, type ListItem } from "../primitives";

interface CommandDef {
  command: string;
  description: string;
  pattern: RegExp;
  /** Whether this command requires a repo context */
  needsRepo?: boolean;
}

const COMMANDS: CommandDef[] = [
  { command: "/repos", description: "Go to repository list (dashboard)", pattern: /^\/repos?$/ },
  { command: "/repo <name>", description: "Open a specific repository", pattern: /^\/repo\s+(.+)$/ },
  { command: "/issues", description: "List issues for current repo", pattern: /^\/issues?$/, needsRepo: true },
  { command: "/issue <number>", description: "Open a specific issue", pattern: /^\/issue\s+(\d+)$/, needsRepo: true },
  { command: "/issue new <title>", description: "Create a new issue", pattern: /^\/issue\s+new\s+(.+)$/, needsRepo: true },
  { command: "/landings", description: "List landing requests for current repo", pattern: /^\/landings?$/, needsRepo: true },
  { command: "/lr <number>", description: "Open a specific landing request", pattern: /^\/lr\s+(\d+)$/, needsRepo: true },
  { command: "/lr new", description: "Create a new landing request", pattern: /^\/lr\s+new$/, needsRepo: true },
  { command: "/changes", description: "List changes for current repo", pattern: /^\/changes?$/, needsRepo: true },
  { command: "/change <id>", description: "Open a specific change", pattern: /^\/change\s+(\S+)$/, needsRepo: true },
  { command: "/diff <id>", description: "View diff for a change", pattern: /^\/diff\s+(\S+)$/, needsRepo: true },
  { command: "/bookmarks", description: "List bookmarks", pattern: /^\/bookmarks?$/, needsRepo: true },
  { command: "/search <query>", description: "Search repositories", pattern: /^\/search\s+(.+)$/ },
  { command: "/wiki", description: "List wiki pages", pattern: /^\/wiki$/, needsRepo: true },
  { command: "/wiki <slug>", description: "View a wiki page", pattern: /^\/wiki\s+(\S+)$/, needsRepo: true },
  { command: "/sync", description: "View sync status", pattern: /^\/sync$/ },
  { command: "/sync now", description: "Force sync now", pattern: /^\/sync\s+now$/ },
  { command: "/conflicts", description: "View sync conflicts", pattern: /^\/conflicts?$/ },
  { command: "/workspace", description: "List workspaces for current repo", pattern: /^\/workspace$/, needsRepo: true },
  { command: "/workspace ssh", description: "SSH into workspace", pattern: /^\/workspace\s+ssh$/, needsRepo: true },
  { command: "/workspace create", description: "Create a new workspace", pattern: /^\/workspace\s+create$/, needsRepo: true },
  { command: "/labels", description: "List labels", pattern: /^\/labels?$/, needsRepo: true },
  { command: "/milestones", description: "List milestones", pattern: /^\/milestones?$/, needsRepo: true },
  { command: "/notifications", description: "View notifications", pattern: /^\/notifications?$/ },
  { command: "/health", description: "Check API health", pattern: /^\/health$/ },
  { command: "/quit", description: "Quit the application", pattern: /^\/q(uit)?$/ },
];

export interface CommandPaletteResult {
  screen: string;
  params: Record<string, string>;
}

export interface CommandPaletteProps {
  onExecute: (result: CommandPaletteResult) => void;
  onCancel: () => void;
  /** Current repo context, if any */
  repoContext?: { owner: string; name: string };
}

export function CommandPalette({ onExecute, onCancel, repoContext }: CommandPaletteProps) {
  const [query, setQuery] = useState("/");

  const filtered = useMemo(() => {
    if (!query) return COMMANDS;
    const lower = query.toLowerCase();
    return COMMANDS.filter((cmd) => {
      // Match against the command name
      return cmd.command.toLowerCase().includes(lower) ||
        cmd.description.toLowerCase().includes(lower);
    });
  }, [query]);

  const handleSubmit = (value: string) => {
    const input = value.trim();
    if (!input) {
      onCancel();
      return;
    }

    // Try to match against each command pattern
    for (const cmd of COMMANDS) {
      const match = input.match(cmd.pattern);
      if (match) {
        const result = resolveCommand(cmd, match, repoContext);
        if (result) {
          onExecute(result);
          return;
        }
      }
    }

    // If no exact match, try partial matching - navigate to the closest command
    const lower = input.toLowerCase();
    if (lower === "/repos" || lower === "/repo") {
      onExecute({ screen: "dashboard", params: {} });
      return;
    }

    // Fallback: treat as search
    if (input.startsWith("/")) {
      const searchQuery = input.slice(1).trim();
      if (searchQuery) {
        onExecute({ screen: "search", params: { query: searchQuery } });
        return;
      }
    }

    onCancel();
  };

  return (
    <InkBox
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      paddingY={0}
      width="100%"
    >
      {/* Command input */}
      <InkBox flexDirection="row" gap={1}>
        <Text color="cyan" bold>Command</Text>
      </InkBox>
      <Input
        value={query}
        onChange={setQuery}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        placeholder="Type a command..."
        prompt="/ "
        active={true}
      />

      {/* Filtered command list */}
      <InkBox flexDirection="column" paddingY={1}>
        {filtered.slice(0, 12).map((cmd, i) => (
          <InkBox key={cmd.command} gap={1}>
            <Text color="yellow" bold>
              {cmd.command.padEnd(24)}
            </Text>
            <Text dimColor>{cmd.description}</Text>
            {cmd.needsRepo && !repoContext && (
              <Text color="gray" dimColor> (needs repo)</Text>
            )}
          </InkBox>
        ))}
        {filtered.length > 12 && (
          <Text dimColor>  ...and {filtered.length - 12} more</Text>
        )}
        {filtered.length === 0 && (
          <Text dimColor>  No matching commands</Text>
        )}
      </InkBox>

      <StatusBar
        bindings={[
          { key: "Enter", label: "execute" },
          { key: "Esc", label: "cancel" },
        ]}
      />
    </InkBox>
  );
}

function resolveCommand(
  cmd: CommandDef,
  match: RegExpMatchArray,
  repoContext?: { owner: string; name: string },
): CommandPaletteResult | null {
  const owner = repoContext?.owner ?? "";
  const name = repoContext?.name ?? "";

  switch (true) {
    // /repos
    case cmd.command === "/repos":
      return { screen: "dashboard", params: {} };

    // /repo <name> - supports owner/name or just name
    case cmd.command === "/repo <name>": {
      const repoArg = match[1]!;
      const parts = repoArg.split("/");
      if (parts.length === 2) {
        return { screen: "repo", params: { owner: parts[0]!, name: parts[1]! } };
      }
      return { screen: "repo", params: { owner: "", name: repoArg } };
    }

    // /issues
    case cmd.command === "/issues":
      return { screen: "issues", params: { owner, name } };

    // /issue <number>
    case cmd.command === "/issue <number>":
      return { screen: "issue-detail", params: { owner, name, issueId: match[1]! } };

    // /issue new <title>
    case cmd.command === "/issue new <title>":
      return { screen: "issue-create", params: { owner, name, title: match[1]! } };

    // /landings
    case cmd.command === "/landings":
      return { screen: "landings", params: { owner, name } };

    // /lr <number>
    case cmd.command === "/lr <number>":
      return { screen: "landing-detail", params: { owner, name, lrId: match[1]! } };

    // /lr new
    case cmd.command === "/lr new":
      return { screen: "lr-create", params: { owner, name } };

    // /changes
    case cmd.command === "/changes":
      return { screen: "changes", params: { owner, name } };

    // /change <id>
    case cmd.command === "/change <id>":
      return { screen: "diff", params: { owner, name, changeId: match[1]! } };

    // /diff <id>
    case cmd.command === "/diff <id>":
      return { screen: "diff", params: { owner, name, changeId: match[1]! } };

    // /bookmarks
    case cmd.command === "/bookmarks":
      return { screen: "bookmarks", params: { owner, name } };

    // /search <query>
    case cmd.command === "/search <query>":
      return { screen: "search", params: { query: match[1]! } };

    // /wiki
    case cmd.command === "/wiki":
      return { screen: "wiki", params: { owner, name } };

    // /wiki <slug>
    case cmd.command === "/wiki <slug>":
      return { screen: "wiki-view", params: { owner, name, slug: match[1]! } };

    // /sync
    case cmd.command === "/sync":
      return { screen: "sync-status", params: {} };

    // /sync now
    case cmd.command === "/sync now":
      return { screen: "sync-now", params: {} };

    // /conflicts
    case cmd.command === "/conflicts":
      return { screen: "sync-conflicts", params: {} };

    // /workspace
    case cmd.command === "/workspace":
      return { screen: "workspaces", params: { owner, name } };

    // /workspace ssh
    case cmd.command === "/workspace ssh":
      return { screen: "workspaces", params: { owner, name } };

    // /workspace create
    case cmd.command === "/workspace create":
      return { screen: "workspace-create", params: { owner, name } };

    // /labels
    case cmd.command === "/labels":
      return { screen: "labels", params: { owner, name } };

    // /milestones
    case cmd.command === "/milestones":
      return { screen: "milestones", params: { owner, name } };

    // /notifications
    case cmd.command === "/notifications":
      return { screen: "notifications", params: {} };

    // /health
    case cmd.command === "/health":
      return { screen: "health", params: {} };

    // /quit
    case cmd.command === "/quit":
      return { screen: "__quit__", params: {} };

    default:
      return null;
  }
}
