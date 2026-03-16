import { atom } from 'nanostores';

export const isSidebarCollapsed = atom(false);
export const isAgentDockOpen = atom(false);
export const isTerminalOpen = atom(false);
export const isCommandPaletteOpen = atom(false);
export const isKeyboardHelpOpen = atom(false);
export const isKeyboardNavigationMode = atom(false);

export type EditorThemePreference = 'jjhub-dark' | 'jjhub-light';

function readStoredValue<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') {
        return fallback;
    }
    try {
        const raw = window.localStorage.getItem(key);
        if (raw == null) {
            return fallback;
        }
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

function createPersistentAtom<T>(key: string, fallback: T) {
    const store = atom<T>(readStoredValue(key, fallback));
    store.listen((value) => {
        if (typeof window === 'undefined') {
            return;
        }
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // Ignore storage failures and keep the in-memory value.
        }
    });
    return store;
}

export const $editorVimMode = createPersistentAtom<boolean>('jjhub.editor.vim_mode', false);
export const $editorTheme = createPersistentAtom<EditorThemePreference>('jjhub.editor.theme', 'jjhub-dark');
export const $editorFontSize = createPersistentAtom<number>('jjhub.editor.font_size', 13);

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
