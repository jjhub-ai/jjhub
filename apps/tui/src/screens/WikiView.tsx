import React, { useState, useEffect } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, Muted, ScrollView, Spinner, StatusBar, ErrorBox, EmptyState } from "../primitives";
import { formatTimeAgo, theme } from "../utils";

export interface WikiViewProps {
  owner: string;
  name: string;
  slug?: string;
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

interface WikiPage {
  slug: string;
  title: string;
  content: string;
  updated_at: string;
}

/** Simple terminal markdown renderer */
function renderMarkdown(content: string): React.ReactNode[] {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeBlockLang = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Code block toggle
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <Box
            key={`code-${i}`}
            flexDirection="column"
            borderStyle="single"
            borderColor={theme.border}
            paddingX={1}
          >
            {codeBlockLang && (
              <Text dimColor bold>{codeBlockLang}</Text>
            )}
            {codeBlockLines.map((codeLine, j) => (
              <Text key={j} color={theme.success}>{codeLine}</Text>
            ))}
          </Box>,
        );
        codeBlockLines = [];
        codeBlockLang = "";
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <Text key={i} bold color={theme.warning}>
          {"   "}{line.slice(4)}
        </Text>,
      );
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <Text key={i} bold color={theme.info}>
          {"  "}{line.slice(3)}
        </Text>,
      );
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <Text key={i} bold color={theme.info} underline>
          {line.slice(2)}
        </Text>,
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line) || /^\*\*\*+$/.test(line)) {
      elements.push(
        <Text key={i} dimColor>
          {"\u2500".repeat(40)}
        </Text>,
      );
      continue;
    }

    // Unordered list items
    if (/^\s*[-*+]\s/.test(line)) {
      const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0;
      const text = line.replace(/^\s*[-*+]\s/, "");
      elements.push(
        <Box key={i} flexDirection="row">
          <Text>{" ".repeat(indent)}</Text>
          <Text color={theme.info}> * </Text>
          <Text>{renderInlineMarkdown(text)}</Text>
        </Box>,
      );
      continue;
    }

    // Ordered list items
    if (/^\s*\d+\.\s/.test(line)) {
      const match = line.match(/^(\s*)(\d+)\.\s(.*)$/);
      if (match) {
        const indent = match[1]?.length ?? 0;
        const num = match[2];
        const text = match[3] ?? "";
        elements.push(
          <Box key={i} flexDirection="row">
            <Text>{" ".repeat(indent)}</Text>
            <Text color={theme.info}> {num}. </Text>
            <Text>{renderInlineMarkdown(text)}</Text>
          </Box>,
        );
        continue;
      }
    }

    // Blockquote
    if (line.startsWith("> ")) {
      elements.push(
        <Box key={i} flexDirection="row">
          <Text color={theme.muted}> | </Text>
          <Text italic dimColor>{renderInlineMarkdown(line.slice(2))}</Text>
        </Box>,
      );
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      elements.push(<Text key={i}>{" "}</Text>);
      continue;
    }

    // Regular paragraph
    elements.push(
      <Text key={i}>{renderInlineMarkdown(line)}</Text>,
    );
  }

  return elements;
}

/** Render inline markdown (bold, italic, code, links) as plain styled text */
function renderInlineMarkdown(text: string): string {
  let result = text.replace(/\*\*(.+?)\*\*/g, "$1");
  result = result.replace(/__(.+?)__/g, "$1");
  result = result.replace(/\*(.+?)\*/g, "$1");
  result = result.replace(/_(.+?)_/g, "$1");
  result = result.replace(/`(.+?)`/g, "$1");
  result = result.replace(/\[(.+?)\]\(.+?\)/g, "$1");
  return result;
}

export function WikiView({ owner, name, slug, onNavigate }: WikiViewProps) {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [currentPage, setCurrentPage] = useState<WikiPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "page">(slug ? "page" : "list");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Fetch wiki pages
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { repoApiFetch } = await import("@jjhub/ui-core");
        if (slug) {
          const response = await repoApiFetch(
            `/wiki/pages/${slug}`,
            {},
            { owner, repo: name },
          );
          if (!response.ok) {
            throw new Error(`Failed to load wiki page (${response.status})`);
          }
          const page = (await response.json()) as WikiPage;
          if (!cancelled) {
            setCurrentPage(page);
            setViewMode("page");
          }
        } else {
          const response = await repoApiFetch(
            "/wiki/pages",
            {},
            { owner, repo: name },
          );
          if (!response.ok) {
            throw new Error(`Failed to load wiki pages (${response.status})`);
          }
          const list = (await response.json()) as WikiPage[];
          if (!cancelled) {
            setPages(Array.isArray(list) ? list : []);
            setViewMode("list");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [owner, name, slug]);

  // Keybindings
  useInput((input, key) => {
    if (viewMode === "list") {
      if (input === "j" || key.downArrow) {
        setSelectedIndex((i) => Math.min(i + 1, pages.length - 1));
      }
      if (input === "k" || key.upArrow) {
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (key.return) {
        const page = pages[selectedIndex];
        if (page) {
          setCurrentPage(page);
          setViewMode("page");
        }
      }
    }

    if (viewMode === "page" && input === "l") {
      setViewMode("list");
      setCurrentPage(null);
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <Heading>Wiki</Heading>
        <Spinner label="Loading wiki pages..." />
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <Heading>Wiki</Heading>
        <ErrorBox message={error.message} hint="Press q to go back." />
      </Box>
    );
  }

  // Page view
  if (viewMode === "page" && currentPage) {
    const rendered = renderMarkdown(currentPage.content);
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Box paddingX={1} gap={2}>
          <Heading>Wiki: {currentPage.title}</Heading>
          <Muted>Updated {formatTimeAgo(currentPage.updated_at)}</Muted>
        </Box>

        <Box flexDirection="column" flexGrow={1} paddingX={1}>
          <ScrollView maxVisible={20}>
            {rendered}
          </ScrollView>
        </Box>

        <StatusBar
          bindings={[
            { key: "j/k", label: "scroll" },
            { key: "l", label: "page list" },
            { key: "q", label: "back" },
          ]}
          left={`${owner}/${name}/wiki/${currentPage.slug}`}
        />
      </Box>
    );
  }

  // List view
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1}>
        <Heading>Wiki Pages</Heading>
      </Box>

      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
        {pages.length === 0 ? (
          <EmptyState
            message="No wiki pages found."
            hint="Create wiki pages from the web UI or CLI."
          />
        ) : (
          pages.map((page, i) => {
            const isSelected = i === selectedIndex;
            return (
              <Box key={page.slug} gap={1}>
                <Text color={isSelected ? theme.accent : undefined}>
                  {isSelected ? ">" : " "}
                </Text>
                <Text bold={isSelected} color={isSelected ? "white" : undefined}>
                  {page.title}
                </Text>
                <Muted>{page.slug}</Muted>
                <Muted>{formatTimeAgo(page.updated_at)}</Muted>
              </Box>
            );
          })
        )}
      </Box>

      <StatusBar
        bindings={[
          { key: "j/k", label: "navigate" },
          { key: "Enter", label: "view" },
          { key: "q", label: "back" },
        ]}
        left={`${pages.length} pages`}
      />
    </Box>
  );
}
