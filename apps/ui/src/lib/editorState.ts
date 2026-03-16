import { atom, computed } from 'nanostores';
import { $editorFontSize, $editorTheme, $editorVimMode } from '../stores/workbench';

export type EditorPreviewType = 'code' | 'markdown' | 'image' | 'pdf' | 'binary';

export interface OpenEditorTab {
    id: string;
    path: string;
    title: string;
    language: string;
    previewType: EditorPreviewType;
}

export const $openTabs = atom<OpenEditorTab[]>([]);
export const $activeTab = atom<string | null>(null);
export const $dirtyFiles = atom<Record<string, boolean>>({});

export const $editorSettings = computed(
    [$editorTheme, $editorFontSize, $editorVimMode],
    (theme, fontSize, vimMode) => ({
        theme,
        fontSize,
        vimMode,
        minimap: true,
    }),
);

export function upsertEditorTab(tab: OpenEditorTab): void {
    const nextTabs = [...$openTabs.get()];
    const existingIndex = nextTabs.findIndex((entry) => entry.id === tab.id);
    if (existingIndex >= 0) {
        nextTabs[existingIndex] = tab;
    } else {
        nextTabs.push(tab);
    }
    $openTabs.set(nextTabs);
    $activeTab.set(tab.id);
}

export function closeEditorTab(tabId: string): void {
    const existingTabs = $openTabs.get();
    const nextTabs = existingTabs.filter((tab) => tab.id !== tabId);
    const activeTab = $activeTab.get();

    $openTabs.set(nextTabs);

    if (activeTab !== tabId) {
        return;
    }

    if (nextTabs.length === 0) {
        $activeTab.set(null);
        return;
    }

    const closedIndex = existingTabs.findIndex((tab) => tab.id === tabId);
    const fallbackIndex = Math.max(0, Math.min(closedIndex, nextTabs.length - 1));
    $activeTab.set(nextTabs[fallbackIndex]?.id ?? null);
}

export function reorderEditorTabs(fromIndex: number, toIndex: number): void {
    const tabs = [...$openTabs.get()];
    if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= tabs.length ||
        toIndex >= tabs.length ||
        fromIndex === toIndex
    ) {
        return;
    }

    const [tab] = tabs.splice(fromIndex, 1);
    tabs.splice(toIndex, 0, tab);
    $openTabs.set(tabs);
}

export function setActiveEditorTab(tabId: string | null): void {
    $activeTab.set(tabId);
}

export function setDirtyFile(path: string, isDirty: boolean): void {
    const next = { ...$dirtyFiles.get() };
    if (isDirty) {
        next[path] = true;
    } else {
        delete next[path];
    }
    $dirtyFiles.set(next);
}

export function resetEditorState(): void {
    $openTabs.set([]);
    $activeTab.set(null);
    $dirtyFiles.set({});
}
