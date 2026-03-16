import { useState, useEffect, useCallback } from "react";
import { repoApiFetch } from "@jjhub/ui-core";
import type { RepoContext } from "@jjhub/ui-core";

// --- Parsed diff types ---

export type DiffFileChangeType = "A" | "M" | "D" | "R";

export type DiffHunkLine = {
    type: "add" | "del" | "context";
    content: string;
    oldLineNo: number | null;
    newLineNo: number | null;
};

export type DiffHunk = {
    header: string;
    oldStart: number;
    oldCount: number;
    newStart: number;
    newCount: number;
    lines: DiffHunkLine[];
};

export type DiffFile = {
    path: string;
    oldPath?: string;
    changeType: DiffFileChangeType;
    hunks: DiffHunk[];
    additions: number;
    deletions: number;
    isBinary: boolean;
    language?: string;
};

export type UseDiffResult = {
    files: DiffFile[];
    totalAdditions: number;
    totalDeletions: number;
    loading: boolean;
    error: Error | undefined;
    refetch: () => void;
};

/**
 * Parse a unified diff patch string into structured hunks.
 */
function parsePatch(patch: string): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    const lines = patch.split("\n");

    let currentHunk: DiffHunk | null = null;
    let oldLine = 0;
    let newLine = 0;

    for (const line of lines) {
        // Hunk header: @@ -oldStart,oldCount +newStart,newCount @@
        const hunkMatch = line.match(
            /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/,
        );
        if (hunkMatch) {
            const oldStart = parseInt(hunkMatch[1]!, 10);
            const oldCount = hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1;
            const newStart = parseInt(hunkMatch[3]!, 10);
            const newCount = hunkMatch[4] !== undefined ? parseInt(hunkMatch[4], 10) : 1;
            const suffix = hunkMatch[5] ?? "";

            currentHunk = {
                header: line,
                oldStart,
                oldCount,
                newStart,
                newCount,
                lines: [],
            };
            hunks.push(currentHunk);
            oldLine = oldStart;
            newLine = newStart;
            continue;
        }

        if (!currentHunk) continue;

        if (line.startsWith("+")) {
            currentHunk.lines.push({
                type: "add",
                content: line.substring(1),
                oldLineNo: null,
                newLineNo: newLine,
            });
            newLine++;
        } else if (line.startsWith("-")) {
            currentHunk.lines.push({
                type: "del",
                content: line.substring(1),
                oldLineNo: oldLine,
                newLineNo: null,
            });
            oldLine++;
        } else if (line.startsWith(" ") || line === "") {
            currentHunk.lines.push({
                type: "context",
                content: line.startsWith(" ") ? line.substring(1) : line,
                oldLineNo: oldLine,
                newLineNo: newLine,
            });
            oldLine++;
            newLine++;
        }
    }

    return hunks;
}

/**
 * Infer the change type letter from the patch content.
 */
function inferChangeType(changeType: string): DiffFileChangeType {
    const normalized = changeType.toLowerCase();
    if (normalized === "add" || normalized === "added" || normalized === "a") return "A";
    if (normalized === "delete" || normalized === "deleted" || normalized === "d") return "D";
    if (normalized === "rename" || normalized === "renamed" || normalized === "r") return "R";
    return "M";
}

/**
 * Fetch diff for a specific change in a repository.
 */
export function useDiff(
    context: RepoContext,
    source: { type: "change"; changeId: string } | { type: "landing"; lrNumber: number },
): UseDiffResult {
    const [files, setFiles] = useState<DiffFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | undefined>(undefined);
    const [fetchKey, setFetchKey] = useState(0);

    const refetch = useCallback(() => {
        setFetchKey((k) => k + 1);
    }, []);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(undefined);

        const path =
            source.type === "change"
                ? `/changes/${encodeURIComponent(source.changeId)}/diff`
                : `/landings/${source.lrNumber}/diff`;

        repoApiFetch(path, {}, context)
            .then(async (response) => {
                if (cancelled) return;
                if (!response.ok) {
                    throw new Error(`Failed to load diff (${response.status})`);
                }

                const contentType = response.headers.get("content-type") ?? "";

                // API may return structured JSON or raw unified diff text
                if (contentType.includes("application/json")) {
                    const body = await response.json();

                    // Handle LandingDiffResponse shape (nested changes[].file_diffs[])
                    if (body.changes && Array.isArray(body.changes)) {
                        const allFiles: DiffFile[] = [];
                        for (const change of body.changes) {
                            for (const fd of change.file_diffs ?? []) {
                                allFiles.push({
                                    path: fd.path,
                                    oldPath: fd.old_path,
                                    changeType: inferChangeType(fd.change_type ?? "M"),
                                    hunks: fd.patch ? parsePatch(fd.patch) : [],
                                    additions: fd.additions ?? 0,
                                    deletions: fd.deletions ?? 0,
                                    isBinary: fd.is_binary ?? false,
                                    language: fd.language,
                                });
                            }
                        }
                        setFiles(allFiles);
                        return;
                    }

                    // Handle flat file_diffs[] shape
                    if (body.file_diffs && Array.isArray(body.file_diffs)) {
                        const allFiles: DiffFile[] = body.file_diffs.map((fd: any) => ({
                            path: fd.path,
                            oldPath: fd.old_path,
                            changeType: inferChangeType(fd.change_type ?? "M"),
                            hunks: fd.patch ? parsePatch(fd.patch) : [],
                            additions: fd.additions ?? 0,
                            deletions: fd.deletions ?? 0,
                            isBinary: fd.is_binary ?? false,
                            language: fd.language,
                        }));
                        setFiles(allFiles);
                        return;
                    }

                    // Handle raw patch string in JSON
                    if (typeof body.patch === "string") {
                        setFiles(parseRawUnifiedDiff(body.patch));
                        return;
                    }

                    setFiles([]);
                } else {
                    // Raw unified diff text
                    const text = await response.text();
                    setFiles(parseRawUnifiedDiff(text));
                }
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err instanceof Error ? err : new Error(String(err)));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [
        context.owner,
        context.repo,
        source.type,
        source.type === "change" ? source.changeId : "",
        source.type === "landing" ? source.lrNumber : 0,
        fetchKey,
    ]);

    const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
    const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

    return { files, totalAdditions, totalDeletions, loading, error, refetch };
}

/**
 * Parse a raw unified diff string (multi-file) into DiffFile[].
 */
function parseRawUnifiedDiff(raw: string): DiffFile[] {
    const files: DiffFile[] = [];
    const diffSections = raw.split(/^diff --git /m);

    for (const section of diffSections) {
        if (!section.trim()) continue;

        const lines = section.split("\n");

        // Extract file paths from --- and +++ lines
        let oldPath: string | undefined;
        let newPath: string | undefined;
        let patchStart = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]!;
            if (line.startsWith("--- a/")) {
                oldPath = line.substring(6);
            } else if (line.startsWith("--- /dev/null")) {
                oldPath = undefined;
            } else if (line.startsWith("+++ b/")) {
                newPath = line.substring(6);
                patchStart = i + 1;
                break;
            } else if (line.startsWith("+++ /dev/null")) {
                newPath = undefined;
                patchStart = i + 1;
                break;
            }
        }

        const filePath = newPath ?? oldPath ?? "unknown";
        let changeType: DiffFileChangeType = "M";
        if (!oldPath && newPath) changeType = "A";
        else if (oldPath && !newPath) changeType = "D";
        else if (oldPath && newPath && oldPath !== newPath) changeType = "R";

        const patchLines = lines.slice(patchStart).join("\n");
        const hunks = parsePatch(patchLines);

        let additions = 0;
        let deletions = 0;
        for (const hunk of hunks) {
            for (const hl of hunk.lines) {
                if (hl.type === "add") additions++;
                if (hl.type === "del") deletions++;
            }
        }

        files.push({
            path: filePath,
            oldPath: oldPath !== newPath ? oldPath : undefined,
            changeType,
            hunks,
            additions,
            deletions,
            isBinary: false,
        });
    }

    return files;
}
