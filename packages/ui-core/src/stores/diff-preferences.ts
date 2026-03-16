/**
 * Diff viewing preferences: view mode, whitespace handling, collapsed files.
 * Works in both browser and terminal environments via the storage abstraction.
 */

import { atom } from "nanostores";
import { readStoredString, writeStoredString, readStoredJSON, writeStoredJSON } from "./storage";

export type DiffViewMode = "split" | "unified";
export type DiffWhitespaceMode = "show" | "ignore";

const VIEW_MODE_KEY = "jjhub.diff.view-mode";
const WHITESPACE_KEY = "jjhub.diff.whitespace";
const COLLAPSED_FILES_KEY = "jjhub.diff.collapsed-files";

function readViewMode(): DiffViewMode {
    return readStoredString(VIEW_MODE_KEY) === "split" ? "split" : "unified";
}

function readWhitespaceMode(): DiffWhitespaceMode {
    return readStoredString(WHITESPACE_KEY) === "ignore" ? "ignore" : "show";
}

function readCollapsedFiles(): Record<string, boolean> {
    const parsed = readStoredJSON<Record<string, boolean>>(COLLAPSED_FILES_KEY);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
}

export const $diffViewMode = atom<DiffViewMode>(readViewMode());
export const $diffWhitespaceMode = atom<DiffWhitespaceMode>(readWhitespaceMode());
export const $collapsedDiffFiles = atom<Record<string, boolean>>(readCollapsedFiles());

$diffViewMode.listen((value) => writeStoredString(VIEW_MODE_KEY, value));
$diffWhitespaceMode.listen((value) => writeStoredString(WHITESPACE_KEY, value));
$collapsedDiffFiles.listen((value) => writeStoredJSON(COLLAPSED_FILES_KEY, value));

export function setDiffViewMode(mode: DiffViewMode): void {
    $diffViewMode.set(mode);
}

export function toggleDiffViewMode(): void {
    $diffViewMode.set($diffViewMode.get() === "split" ? "unified" : "split");
}

export function setDiffWhitespaceMode(mode: DiffWhitespaceMode): void {
    $diffWhitespaceMode.set(mode);
}

export function setCollapsedDiffFile(fileId: string, collapsed: boolean): void {
    $collapsedDiffFiles.set({
        ...$collapsedDiffFiles.get(),
        [fileId]: collapsed,
    });
}

export function toggleCollapsedDiffFile(fileId: string): void {
    const current = $collapsedDiffFiles.get();
    setCollapsedDiffFile(fileId, !current[fileId]);
}

export function resetDiffPreferences(): void {
    $diffViewMode.set("unified");
    $diffWhitespaceMode.set("show");
    $collapsedDiffFiles.set({});
}
