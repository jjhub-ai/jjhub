/**
 * Workbench UI state: sidebar, panels, and editor preferences.
 * Works in both browser and terminal environments.
 */

import { atom } from "nanostores";
import { createPersistentAtom } from "./storage";

export const isSidebarCollapsed = atom(false);
export const isAgentDockOpen = atom(false);
export const isTerminalOpen = atom(false);
export const isCommandPaletteOpen = atom(false);
export const isKeyboardHelpOpen = atom(false);
export const isKeyboardNavigationMode = atom(false);

export type EditorThemePreference = "jjhub-dark" | "jjhub-light";

export const $editorVimMode = createPersistentAtom<boolean>("jjhub.editor.vim_mode", false);
export const $editorTheme = createPersistentAtom<EditorThemePreference>("jjhub.editor.theme", "jjhub-dark");
export const $editorFontSize = createPersistentAtom<number>("jjhub.editor.font_size", 13);

export function toggleSidebar() {
    isSidebarCollapsed.set(!isSidebarCollapsed.get());
}

export function toggleAgentDock() {
    isAgentDockOpen.set(!isAgentDockOpen.get());
}

export function toggleTerminal() {
    isTerminalOpen.set(!isTerminalOpen.get());
}

export function toggleCommandPalette() {
    isCommandPaletteOpen.set(!isCommandPaletteOpen.get());
}

export function openKeyboardHelp() {
    isKeyboardHelpOpen.set(true);
}

export function closeKeyboardHelp() {
    isKeyboardHelpOpen.set(false);
}

export function toggleKeyboardHelp() {
    isKeyboardHelpOpen.set(!isKeyboardHelpOpen.get());
}
