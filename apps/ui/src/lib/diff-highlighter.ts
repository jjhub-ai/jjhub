import type { DiffHighlighter } from "@git-diff-view/solid";
import { getDiffViewHighlighter } from "@git-diff-view/shiki";

const DIFF_LANGUAGES = [
    "bash",
    "css",
    "diff",
    "dockerfile",
    "go",
    "html",
    "javascript",
    "json",
    "jsx",
    "kotlin",
    "markdown",
    "python",
    "rust",
    "sql",
    "swift",
    "tsx",
    "typescript",
    "xml",
    "yaml",
] as const;

let highlighterPromise: Promise<DiffHighlighter> | null = null;

export function getDiffHighlighter(): Promise<DiffHighlighter> {
    if (!highlighterPromise) {
        highlighterPromise = getDiffViewHighlighter([...DIFF_LANGUAGES]) as unknown as Promise<DiffHighlighter>;
    }
    return highlighterPromise;
}
