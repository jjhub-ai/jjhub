import { For, Show } from 'solid-js';
import { getShortcutKeys, type ShortcutKeys, type ShortcutPlatform } from '../../lib/keyboard';
import { isMacPlatform } from '../../lib/keyboard/utils';

type ShortcutBadgeProps = {
    shortcutId?: string;
    keys?: ShortcutKeys;
    class?: string;
};

function resolveKeys(props: ShortcutBadgeProps, platform: ShortcutPlatform): ShortcutKeys {
    if (props.keys && props.keys.length > 0) {
        return props.keys;
    }
    if (!props.shortcutId) {
        return [];
    }
    return getShortcutKeys(props.shortcutId, platform) ?? [];
}

function displayToken(token: string, platform: ShortcutPlatform): string {
    if (platform === 'mac') {
        switch (token) {
            case 'Cmd':
                return '⌘';
            case 'Ctrl':
                return '^';
            case 'Shift':
                return '⇧';
            case 'Alt':
                return '⌥';
        }
    }
    return token;
}

export default function ShortcutBadge(props: ShortcutBadgeProps) {
    const platform: ShortcutPlatform = isMacPlatform() ? 'mac' : 'default';
    const keys = () => resolveKeys(props, platform);

    return (
        <Show when={keys().length > 0}>
            <span class={`shortcut-badge ${props.class ?? ''}`.trim()}>
                <For each={keys()}>
                    {(combo, index) => (
                        <>
                            <Show when={index() > 0}>
                                <span class="shortcut-token-separator">/</span>
                            </Show>
                            <span class="shortcut-step">
                                <For each={combo}>
                                    {(token) => <kbd>{displayToken(token, platform)}</kbd>}
                                </For>
                            </span>
                        </>
                    )}
                </For>
            </span>
        </Show>
    );
}
