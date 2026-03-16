import { For, Show } from 'solid-js';
import { X } from 'lucide-solid';
import type { OpenEditorTab } from '../../lib/editorState';

interface EditorTabsProps {
    tabs: OpenEditorTab[];
    activeTabId: string | null;
    dirtyFiles: Record<string, boolean>;
    onSelect: (tabId: string) => void;
    onClose: (tabId: string) => void;
}

export default function EditorTabs(props: EditorTabsProps) {
    return (
        <div class="editor-tabs" role="tablist" aria-label="Open files">
            <For each={props.tabs}>
                {(tab) => (
                    <button
                        type="button"
                        class={`editor-tab ${props.activeTabId === tab.id ? 'active' : ''}`}
                        onClick={() => props.onSelect(tab.id)}
                        role="tab"
                        aria-selected={props.activeTabId === tab.id}
                    >
                        <span class="editor-tab-title">{tab.title}</span>
                        <Show when={props.dirtyFiles[tab.path]}>
                            <span class="editor-tab-dot" aria-label="Unsaved local draft" />
                        </Show>
                        <span
                            class="editor-tab-close"
                            role="button"
                            tabindex={0}
                            onClick={(event) => {
                                event.stopPropagation();
                                props.onClose(tab.id);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    props.onClose(tab.id);
                                }
                            }}
                        >
                            <X size={14} />
                        </span>
                    </button>
                )}
            </For>
        </div>
    );
}
