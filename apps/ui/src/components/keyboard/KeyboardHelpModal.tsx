import { createEffect, createMemo, createSignal, For, Show } from 'solid-js';
import ShortcutBadge from './ShortcutBadge';
import { listKeyboardShortcuts } from '../../lib/keyboard';

type KeyboardHelpModalProps = {
    open: boolean;
    onClose: () => void;
};

export default function KeyboardHelpModal(props: KeyboardHelpModalProps) {
    const [query, setQuery] = createSignal('');
    let searchInputRef: HTMLInputElement | undefined;

    createEffect(() => {
        if (!props.open) {
            return;
        }

        setQuery('');
        window.setTimeout(() => searchInputRef?.focus(), 0);
    });

    const groups = createMemo(() => {
        const needle = query().trim().toLowerCase();
        const entries = listKeyboardShortcuts().filter((entry) => {
            if (!needle) {
                return true;
            }

            const keyText = entry.keys.flat().join(' ').toLowerCase();
            return `${entry.label} ${entry.category} ${entry.id} ${keyText}`.toLowerCase().includes(needle);
        });

        const grouped = new Map<string, typeof entries>();
        for (const entry of entries) {
            const bucket = grouped.get(entry.category) ?? [];
            bucket.push(entry);
            grouped.set(entry.category, bucket);
        }
        return Array.from(grouped.entries());
    });

    return (
        <Show when={props.open}>
            <div class="keyboard-help-overlay" onClick={props.onClose}>
                <div
                    class="keyboard-help-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Keyboard shortcuts"
                    onClick={(event) => event.stopPropagation()}
                >
                    <div class="keyboard-help-header">
                        <div>
                            <p class="keyboard-help-eyebrow">Keyboard</p>
                            <h2>Shortcuts</h2>
                        </div>
                        <button class="btn" type="button" onClick={props.onClose}>Close</button>
                    </div>

                    <div class="keyboard-help-search">
                        <input
                            ref={searchInputRef}
                            type="search"
                            placeholder="Filter shortcuts"
                            aria-label="Filter keyboard shortcuts"
                            value={query()}
                            onInput={(event) => setQuery(event.currentTarget.value)}
                        />
                    </div>

                    <div class="keyboard-help-grid">
                        <For each={groups()}>
                            {([category, entries]) => (
                                <section class="keyboard-help-section">
                                    <h3>{category}</h3>
                                    <div class="keyboard-help-list">
                                        <For each={entries}>
                                            {(entry) => (
                                                <div class="keyboard-help-row">
                                                    <div class="keyboard-help-copy">
                                                        <strong>{entry.label}</strong>
                                                        <span>{entry.id}</span>
                                                    </div>
                                                    <ShortcutBadge keys={entry.keys} />
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </section>
                            )}
                        </For>
                    </div>

                    <div class="keyboard-help-footer">
                        Use <kbd>g</kbd> then a second key for navigation. Press <kbd>?</kbd> again to close.
                    </div>
                </div>
            </div>
        </Show>
    );
}
