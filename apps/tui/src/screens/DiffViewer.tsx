import React, { useState, useMemo, useCallback } from "react";
import { Box as InkBox, Text as InkText, useInput, useStdout } from "ink";
import { Box, Text, Heading, Spinner, StatusBar } from "../primitives";
import { useDiff, type DiffFile, type DiffHunkLine, type DiffHunk } from "../hooks/useDiff";

export interface DiffViewerProps {
  owner: string;
  name: string;
  /** For change diffs */
  changeId?: string;
  /** For landing request diffs */
  lrNumber?: string;
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

// --- Rendered line types ---

type RenderedLine = {
  key: string;
  type: "file-header" | "hunk-header" | "add" | "del" | "context" | "binary" | "separator";
  content: string;
  oldLineNo?: number | null;
  newLineNo?: number | null;
  /** For side-by-side: the left and right content */
  leftContent?: string;
  rightContent?: string;
  leftType?: "del" | "context" | "empty";
  rightType?: "add" | "context" | "empty";
  fileIndex?: number;
};

// --- Change type badge color ---

function changeTypeColor(ct: string): string {
  switch (ct) {
    case "A": return "green";
    case "D": return "red";
    case "R": return "yellow";
    default: return "blue";
  }
}

function changeTypeLabel(ct: string): string {
  switch (ct) {
    case "A": return "added";
    case "D": return "deleted";
    case "R": return "renamed";
    default: return "modified";
  }
}

// --- Build flat line list from parsed diff files ---

function buildUnifiedLines(files: DiffFile[]): RenderedLine[] {
  const lines: RenderedLine[] = [];

  files.forEach((file, fi) => {
    // File header
    if (fi > 0) {
      lines.push({
        key: `sep-${fi}`,
        type: "separator",
        content: "",
        fileIndex: fi,
      });
    }

    const displayPath = file.oldPath && file.oldPath !== file.path
      ? `${file.oldPath} -> ${file.path}`
      : file.path;

    lines.push({
      key: `fh-${fi}`,
      type: "file-header",
      content: displayPath,
      fileIndex: fi,
    });

    if (file.isBinary) {
      lines.push({
        key: `bin-${fi}`,
        type: "binary",
        content: "Binary file differs",
        fileIndex: fi,
      });
      return;
    }

    file.hunks.forEach((hunk, hi) => {
      lines.push({
        key: `hh-${fi}-${hi}`,
        type: "hunk-header",
        content: hunk.header,
        fileIndex: fi,
      });

      hunk.lines.forEach((hl, li) => {
        lines.push({
          key: `ln-${fi}-${hi}-${li}`,
          type: hl.type === "add" ? "add" : hl.type === "del" ? "del" : "context",
          content: hl.content,
          oldLineNo: hl.oldLineNo,
          newLineNo: hl.newLineNo,
          fileIndex: fi,
        });
      });
    });
  });

  return lines;
}

// --- Build side-by-side lines ---

type SideBySideLine = {
  key: string;
  type: "file-header" | "hunk-header" | "pair" | "binary" | "separator";
  /** For file/hunk headers */
  content?: string;
  leftLineNo?: number | null;
  leftContent?: string;
  leftType?: "del" | "context" | "empty";
  rightLineNo?: number | null;
  rightContent?: string;
  rightType?: "add" | "context" | "empty";
  fileIndex?: number;
};

function buildSideBySideLines(files: DiffFile[]): SideBySideLine[] {
  const result: SideBySideLine[] = [];

  files.forEach((file, fi) => {
    if (fi > 0) {
      result.push({
        key: `sep-${fi}`,
        type: "separator",
        fileIndex: fi,
      });
    }

    const displayPath = file.oldPath && file.oldPath !== file.path
      ? `${file.oldPath} -> ${file.path}`
      : file.path;

    result.push({
      key: `fh-${fi}`,
      type: "file-header",
      content: displayPath,
      fileIndex: fi,
    });

    if (file.isBinary) {
      result.push({
        key: `bin-${fi}`,
        type: "binary",
        content: "Binary file differs",
        fileIndex: fi,
      });
      return;
    }

    file.hunks.forEach((hunk, hi) => {
      result.push({
        key: `hh-${fi}-${hi}`,
        type: "hunk-header",
        content: hunk.header,
        fileIndex: fi,
      });

      // Pair up deletions and additions
      const hunkLines = hunk.lines;
      let i = 0;

      while (i < hunkLines.length) {
        const line = hunkLines[i]!;

        if (line.type === "context") {
          result.push({
            key: `sbs-${fi}-${hi}-${i}`,
            type: "pair",
            leftLineNo: line.oldLineNo,
            leftContent: line.content,
            leftType: "context",
            rightLineNo: line.newLineNo,
            rightContent: line.content,
            rightType: "context",
            fileIndex: fi,
          });
          i++;
          continue;
        }

        // Collect consecutive deletions then additions to pair them
        if (line.type === "del") {
          const dels: DiffHunkLine[] = [];
          while (i < hunkLines.length && hunkLines[i]!.type === "del") {
            dels.push(hunkLines[i]!);
            i++;
          }
          const adds: DiffHunkLine[] = [];
          while (i < hunkLines.length && hunkLines[i]!.type === "add") {
            adds.push(hunkLines[i]!);
            i++;
          }

          const maxPairs = Math.max(dels.length, adds.length);
          for (let p = 0; p < maxPairs; p++) {
            const d = dels[p];
            const a = adds[p];
            result.push({
              key: `sbs-${fi}-${hi}-del${p}-add${p}`,
              type: "pair",
              leftLineNo: d?.oldLineNo ?? null,
              leftContent: d?.content ?? "",
              leftType: d ? "del" : "empty",
              rightLineNo: a?.newLineNo ?? null,
              rightContent: a?.content ?? "",
              rightType: a ? "add" : "empty",
              fileIndex: fi,
            });
          }
          continue;
        }

        if (line.type === "add") {
          result.push({
            key: `sbs-${fi}-${hi}-add-${i}`,
            type: "pair",
            leftLineNo: null,
            leftContent: "",
            leftType: "empty",
            rightLineNo: line.newLineNo,
            rightContent: line.content,
            rightType: "add",
            fileIndex: fi,
          });
          i++;
          continue;
        }

        i++;
      }
    });
  });

  return result;
}

// --- Compute file offsets (line index where each file starts) ---

function computeFileOffsets(lines: Array<{ fileIndex?: number }>): number[] {
  const offsets: number[] = [];
  let lastFileIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const fi = lines[i]!.fileIndex;
    if (fi !== undefined && fi !== lastFileIndex) {
      while (offsets.length <= fi) offsets.push(i);
      lastFileIndex = fi;
    }
  }
  return offsets;
}

// --- Main component ---

export function DiffViewer({ owner, name, changeId, lrNumber, onNavigate }: DiffViewerProps) {
  const source = changeId
    ? ({ type: "change" as const, changeId })
    : ({ type: "landing" as const, lrNumber: parseInt(lrNumber ?? "0", 10) });

  const { files, totalAdditions, totalDeletions, loading, error } = useDiff(
    { owner, repo: name },
    source,
  );

  const [scrollOffset, setScrollOffset] = useState(0);
  const [showFileList, setShowFileList] = useState(false);
  const [sideBySide, setSideBySide] = useState(false);
  const [fileListIndex, setFileListIndex] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);

  const { stdout } = useStdout();
  const termHeight = stdout?.rows ?? 24;
  const termWidth = stdout?.columns ?? 80;
  // Reserve 3 lines for header + status bar
  const maxVisible = Math.max(5, termHeight - 4);

  // Build rendered lines
  const unifiedLines = useMemo(() => buildUnifiedLines(files), [files]);
  const sbsLines = useMemo(() => buildSideBySideLines(files), [files]);

  const displayLines = sideBySide ? sbsLines : unifiedLines;
  const totalLines = displayLines.length;
  const maxOffset = Math.max(0, totalLines - maxVisible);

  // File offsets for n/N navigation
  const fileOffsets = useMemo(() => computeFileOffsets(displayLines), [displayLines]);

  // Navigate to next/previous file
  const goToNextFile = useCallback(() => {
    const nextFi = currentFileIndex + 1;
    if (nextFi < fileOffsets.length) {
      setCurrentFileIndex(nextFi);
      const offset = fileOffsets[nextFi]!;
      setScrollOffset(Math.min(offset, maxOffset));
    }
  }, [currentFileIndex, fileOffsets, maxOffset]);

  const goToPrevFile = useCallback(() => {
    const prevFi = currentFileIndex - 1;
    if (prevFi >= 0) {
      setCurrentFileIndex(prevFi);
      const offset = fileOffsets[prevFi]!;
      setScrollOffset(Math.min(offset, maxOffset));
    }
  }, [currentFileIndex, fileOffsets, maxOffset]);

  // File list navigation
  const fileListActive = showFileList;

  useInput(
    (input, key) => {
      // Toggle modes
      if (input === "f") {
        setShowFileList((v) => !v);
        return;
      }
      if (input === "s") {
        setSideBySide((v) => !v);
        setScrollOffset(0);
        return;
      }

      // File list navigation (when file list is shown)
      if (fileListActive) {
        if (input === "j" || key.downArrow) {
          setFileListIndex((i) => Math.min(i + 1, files.length - 1));
          return;
        }
        if (input === "k" || key.upArrow) {
          setFileListIndex((i) => Math.max(i - 1, 0));
          return;
        }
        if (key.return) {
          // Jump to selected file
          const offset = fileOffsets[fileListIndex];
          if (offset !== undefined) {
            setCurrentFileIndex(fileListIndex);
            setScrollOffset(Math.min(offset, maxOffset));
            setShowFileList(false);
          }
          return;
        }
      }

      // Scrolling
      if (input === "j" || key.downArrow) {
        setScrollOffset((o) => Math.min(o + 1, maxOffset));
        return;
      }
      if (input === "k" || key.upArrow) {
        setScrollOffset((o) => Math.max(o - 1, 0));
        return;
      }

      // Page down/up
      if (input === "d" && key.ctrl) {
        setScrollOffset((o) => Math.min(o + Math.floor(maxVisible / 2), maxOffset));
        return;
      }
      if (input === "u" && key.ctrl) {
        setScrollOffset((o) => Math.max(o - Math.floor(maxVisible / 2), 0));
        return;
      }

      // Page Up / Page Down (arrow-based)
      if (key.pageDown) {
        setScrollOffset((o) => Math.min(o + maxVisible, maxOffset));
        return;
      }
      if (key.pageUp) {
        setScrollOffset((o) => Math.max(o - maxVisible, 0));
        return;
      }

      // Top/bottom
      if (input === "g") {
        setScrollOffset(0);
        return;
      }
      if (input === "G") {
        setScrollOffset(maxOffset);
        return;
      }

      // Next/previous file
      if (input === "n") {
        goToNextFile();
        return;
      }
      if (input === "N") {
        goToPrevFile();
        return;
      }
    },
  );

  // --- Loading/Error states ---

  if (loading) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
        <Spinner label="Loading diff..." />
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
        <Text color="red">Error: {error.message}</Text>
      </Box>
    );
  }

  if (files.length === 0) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
        <Text dimColor>No changes in this diff.</Text>
        <StatusBar
          bindings={[{ key: "q", label: "back" }]}
          left={changeId ? `change ${changeId}` : `landing !${lrNumber}`}
        />
      </Box>
    );
  }

  // --- Summary header ---

  const summaryText = `${files.length} file${files.length !== 1 ? "s" : ""} changed`;
  const addText = totalAdditions > 0 ? `+${totalAdditions}` : "";
  const delText = totalDeletions > 0 ? `-${totalDeletions}` : "";
  const sourceLabel = changeId ? `change ${changeId}` : `landing !${lrNumber}`;

  // --- Render ---

  const halfWidth = Math.floor((termWidth - 3) / 2); // -3 for divider and padding

  const visibleLines = displayLines.slice(scrollOffset, scrollOffset + maxVisible);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Summary header */}
      <InkBox paddingX={1} gap={1}>
        <Heading>Diff</Heading>
        <InkText dimColor>{summaryText}</InkText>
        {addText && <InkText color="green" bold>{addText}</InkText>}
        {delText && <InkText color="red" bold>{delText}</InkText>}
        {sideBySide && <InkText color="yellow">[side-by-side]</InkText>}
      </InkBox>

      {/* Main content area */}
      <InkBox flexDirection="row" flexGrow={1}>
        {/* File list sidebar */}
        {showFileList && (
          <InkBox
            flexDirection="column"
            width={Math.min(40, Math.floor(termWidth / 3))}
            borderStyle="single"
            borderColor="gray"
            paddingX={1}
          >
            <InkText bold color="cyan">Files</InkText>
            {files.map((file, i) => {
              const isSelected = i === fileListIndex;
              const shortPath = file.path.length > 35
                ? "..." + file.path.slice(file.path.length - 32)
                : file.path;
              return (
                <InkBox key={file.path + i} gap={1}>
                  <InkText color={isSelected ? "cyan" : undefined}>
                    {isSelected ? ">" : " "}
                  </InkText>
                  <InkText color={changeTypeColor(file.changeType)} bold>
                    {file.changeType}
                  </InkText>
                  <InkText
                    bold={isSelected}
                    color={isSelected ? "white" : undefined}
                    wrap="truncate"
                  >
                    {shortPath}
                  </InkText>
                  <InkText dimColor>
                    +{file.additions} -{file.deletions}
                  </InkText>
                </InkBox>
              );
            })}
          </InkBox>
        )}

        {/* Diff content */}
        <InkBox flexDirection="column" flexGrow={1}>
          {sideBySide
            ? renderSideBySide(visibleLines as SideBySideLine[], halfWidth)
            : renderUnified(visibleLines as RenderedLine[])}
        </InkBox>
      </InkBox>

      {/* Scroll indicator */}
      {totalLines > maxVisible && (
        <InkBox paddingX={1}>
          <InkText dimColor>
            {scrollOffset + 1}-{Math.min(scrollOffset + maxVisible, totalLines)} of {totalLines} lines
          </InkText>
        </InkBox>
      )}

      <StatusBar
        bindings={[
          { key: "j/k", label: "scroll" },
          { key: "n/N", label: "next/prev file" },
          { key: "f", label: showFileList ? "hide files" : "files" },
          { key: "s", label: sideBySide ? "unified" : "split" },
          { key: "q", label: "back" },
        ]}
        left={`${owner}/${name} ${sourceLabel}`}
      />
    </Box>
  );
}

// --- Unified diff renderer ---

function renderUnified(lines: RenderedLine[]): React.ReactNode {
  return (
    <InkBox flexDirection="column">
      {lines.map((line) => {
        switch (line.type) {
          case "separator":
            return (
              <InkBox key={line.key} paddingY={0}>
                <InkText dimColor>{"".padEnd(60, "\u2500")}</InkText>
              </InkBox>
            );
          case "file-header":
            return (
              <InkBox key={line.key} gap={1}>
                <InkText color="cyan" bold>
                  {"--- a/" + line.content}
                </InkText>
              </InkBox>
            );
          case "hunk-header":
            return (
              <InkBox key={line.key}>
                <InkText color="yellow">{line.content}</InkText>
              </InkBox>
            );
          case "binary":
            return (
              <InkBox key={line.key} paddingX={2}>
                <InkText dimColor italic>{line.content}</InkText>
              </InkBox>
            );
          case "add":
            return (
              <InkBox key={line.key} gap={0}>
                <InkText dimColor>
                  {"   "}
                  {formatLineNo(line.newLineNo)}
                  {" "}
                </InkText>
                <InkText color="green">+{line.content}</InkText>
              </InkBox>
            );
          case "del":
            return (
              <InkBox key={line.key} gap={0}>
                <InkText dimColor>
                  {formatLineNo(line.oldLineNo)}
                  {"    "}
                </InkText>
                <InkText color="red">-{line.content}</InkText>
              </InkBox>
            );
          case "context":
            return (
              <InkBox key={line.key} gap={0}>
                <InkText dimColor>
                  {formatLineNo(line.oldLineNo)}
                  {" "}
                  {formatLineNo(line.newLineNo)}
                  {" "}
                </InkText>
                <InkText> {line.content}</InkText>
              </InkBox>
            );
          default:
            return null;
        }
      })}
    </InkBox>
  );
}

// --- Side-by-side diff renderer ---

function renderSideBySide(lines: SideBySideLine[], halfWidth: number): React.ReactNode {
  const contentWidth = Math.max(10, halfWidth - 6); // 6 chars for line numbers + padding

  return (
    <InkBox flexDirection="column">
      {lines.map((line) => {
        switch (line.type) {
          case "separator":
            return (
              <InkBox key={line.key}>
                <InkText dimColor>{"".padEnd(halfWidth * 2 + 3, "\u2500")}</InkText>
              </InkBox>
            );
          case "file-header":
            return (
              <InkBox key={line.key} gap={1}>
                <InkText color="cyan" bold>
                  {line.content}
                </InkText>
              </InkBox>
            );
          case "hunk-header":
            return (
              <InkBox key={line.key}>
                <InkText color="yellow">{line.content}</InkText>
              </InkBox>
            );
          case "binary":
            return (
              <InkBox key={line.key} paddingX={2}>
                <InkText dimColor italic>{line.content}</InkText>
              </InkBox>
            );
          case "pair": {
            const leftLine = truncate(line.leftContent ?? "", contentWidth);
            const rightLine = truncate(line.rightContent ?? "", contentWidth);

            const leftColor =
              line.leftType === "del" ? "red"
                : line.leftType === "empty" ? undefined
                  : undefined;

            const rightColor =
              line.rightType === "add" ? "green"
                : line.rightType === "empty" ? undefined
                  : undefined;

            return (
              <InkBox key={line.key}>
                {/* Left side */}
                <InkBox width={halfWidth}>
                  <InkText dimColor>{formatLineNo(line.leftLineNo)} </InkText>
                  {line.leftType === "empty" ? (
                    <InkText dimColor>{""}</InkText>
                  ) : line.leftType === "del" ? (
                    <InkText color="red">-{leftLine}</InkText>
                  ) : (
                    <InkText> {leftLine}</InkText>
                  )}
                </InkBox>

                {/* Divider */}
                <InkText dimColor>{"\u2502"}</InkText>

                {/* Right side */}
                <InkBox width={halfWidth}>
                  <InkText dimColor>{formatLineNo(line.rightLineNo)} </InkText>
                  {line.rightType === "empty" ? (
                    <InkText dimColor>{""}</InkText>
                  ) : line.rightType === "add" ? (
                    <InkText color="green">+{rightLine}</InkText>
                  ) : (
                    <InkText> {rightLine}</InkText>
                  )}
                </InkBox>
              </InkBox>
            );
          }
          default:
            return null;
        }
      })}
    </InkBox>
  );
}

// --- Helpers ---

function formatLineNo(lineNo: number | null | undefined): string {
  if (lineNo == null) return "   ";
  return String(lineNo).padStart(3, " ");
}

function truncate(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) return text;
  return text.substring(0, maxWidth - 1) + "\u2026";
}
