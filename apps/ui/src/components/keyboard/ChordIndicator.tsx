import { For, Show } from 'solid-js';
import ShortcutBadge from './ShortcutBadge';
import type { ChordState } from '../../lib/keyboard';

type ChordIndicatorProps = {
    state: ChordState | null;
};

export default function ChordIndicator(props: ChordIndicatorProps) {
    return (
        <Show when={props.state}>
            {(state) => (
                <div class="chord-indicator">
                    <div class="chord-indicator-leader">{state().leader}</div>
                    <div class="chord-indicator-hints">
                        <For each={state().hints}>
                            {(hint) => (
                                <div class="chord-indicator-hint">
                                    <ShortcutBadge keys={[[hint.key.toUpperCase()]]} />
                                    <span>{hint.description}</span>
                                </div>
                            )}
                        </For>
                    </div>
                </div>
            )}
        </Show>
    );
}
