import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js';
import { isMacPlatform } from './utils';

export type ShortcutPlatform = 'default' | 'mac';
export type ShortcutKeys = string[][];

export type ShortcutDefinition = {
    label: string;
    category: string;
    keys: ShortcutKeys | Partial<Record<ShortcutPlatform, ShortcutKeys>>;
};

type ListNavigationOptions<T> = {
    items: Accessor<T[]>;
    onOpen: (item: T) => void;
    onCreate?: () => void;
    onFocusSearch?: () => void;
    getItemId?: (item: T, index: number) => string | number;
};

type ChordBinding = {
    leader: string;
    key: string;
    description: string;
    action: () => void;
};

type ChordShortcutOptions = {
    bindings: Accessor<ChordBinding[]>;
    enabled?: Accessor<boolean>;
};

type SingleKeyBinding = {
    key: string;
    action: () => void;
};

type SingleKeyShortcutOptions = {
    bindings: Accessor<SingleKeyBinding[]>;
    enabled?: Accessor<boolean>;
};

export type ChordHint = {
    key: string;
    description: string;
};

export type ChordState = {
    leader: string;
    hints: ChordHint[];
};

export type KeyboardAction = 'comment' | 'assign' | 'label';

type ItemRefMap = Record<number, HTMLElement | undefined>;

const SEARCH_FOCUS_EVENT = 'jjhub:focus-search';
const KEYBOARD_ACTION_EVENT = 'jjhub:keyboard-action';

const DEFAULT_SHORTCUTS: Record<string, ShortcutDefinition> = {
    'palette.open': {
        label: 'Open command palette',
        category: 'Workbench',
        keys: {
            default: [['Ctrl', 'K']],
            mac: [['Cmd', 'K']],
        },
    },
    'help.open': {
        label: 'Open keyboard shortcuts',
        category: 'Workbench',
        keys: [['?']],
    },
    'panel.sidebar': {
        label: 'Toggle sidebar',
        category: 'Workbench',
        keys: {
            default: [['Ctrl', 'B']],
            mac: [['Cmd', 'B']],
        },
    },
    'panel.agentDock': {
        label: 'Toggle agent dock',
        category: 'Workbench',
        keys: {
            default: [['Ctrl', 'J']],
            mac: [['Cmd', 'J']],
        },
    },
    'panel.terminal': {
        label: 'Toggle terminal dock',
        category: 'Workbench',
        keys: [['Ctrl', '`']],
    },
    'search.focus': {
        label: 'Focus search',
        category: 'Navigation',
        keys: [['/']],
    },
    'nav.home': {
        label: 'Go to repositories',
        category: 'Navigation',
        keys: [['G', 'R'], ['G', 'H']],
    },
    'nav.inbox': {
        label: 'Go to inbox',
        category: 'Navigation',
        keys: [['G', 'N']],
    },
    'nav.settings': {
        label: 'Go to settings',
        category: 'Navigation',
        keys: [['G', 'S']],
    },
    'nav.issues': {
        label: 'Go to issues',
        category: 'Navigation',
        keys: [['G', 'I']],
    },
    'nav.landings': {
        label: 'Go to landing requests',
        category: 'Navigation',
        keys: [['G', 'L']],
    },
    'nav.changes': {
        label: 'Go to changes',
        category: 'Navigation',
        keys: [['G', 'C']],
    },
    'nav.bookmarks': {
        label: 'Go to bookmarks',
        category: 'Navigation',
        keys: [['G', 'B']],
    },
    'nav.workflows': {
        label: 'Go to workflows',
        category: 'Navigation',
        keys: [['G', 'W']],
    },
    'nav.repoTerminal': {
        label: 'Go to terminal',
        category: 'Navigation',
        keys: [['G', 'T']],
    },
    'page.pin': {
        label: 'Pin or unpin current page',
        category: 'Navigation',
        keys: [['Alt', 'P']],
    },
    'list.next': {
        label: 'Move to next row',
        category: 'Lists',
        keys: [['J'], ['ArrowDown']],
    },
    'list.previous': {
        label: 'Move to previous row',
        category: 'Lists',
        keys: [['K'], ['ArrowUp']],
    },
    'list.open': {
        label: 'Open selected row',
        category: 'Lists',
        keys: [['Enter']],
    },
    'list.search': {
        label: 'Focus list search',
        category: 'Lists',
        keys: [['/']],
    },
    'list.select': {
        label: 'Select focused row',
        category: 'Lists',
        keys: [['X']],
    },
    'list.create': {
        label: 'Create item',
        category: 'Lists',
        keys: [['C']],
    },
    'issue.comment': {
        label: 'Focus comment composer',
        category: 'Issues',
        keys: [['C']],
    },
    'issue.assign': {
        label: 'Edit assignees',
        category: 'Issues',
        keys: [['A']],
    },
    'issue.labels': {
        label: 'Edit labels',
        category: 'Issues',
        keys: [['L']],
    },
    'landing.comment': {
        label: 'Focus comment composer',
        category: 'Landings',
        keys: [['C']],
    },
};

function cloneShortcutKeys(
    keys: ShortcutKeys | Partial<Record<ShortcutPlatform, ShortcutKeys>>,
): ShortcutKeys | Partial<Record<ShortcutPlatform, ShortcutKeys>> {
    if (Array.isArray(keys)) {
        return keys.map((combo) => [...combo]);
    }

    const cloned: Partial<Record<ShortcutPlatform, ShortcutKeys>> = {};
    for (const [platform, value] of Object.entries(keys)) {
        cloned[platform as ShortcutPlatform] = value?.map((combo) => [...combo]);
    }
    return cloned;
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

export function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }
    return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function createShortcutRegistry(initialShortcuts: Record<string, ShortcutDefinition> = DEFAULT_SHORTCUTS) {
    const registry = new Map<string, ShortcutDefinition>(
        Object.entries(initialShortcuts).map(([shortcutId, definition]) => [
            shortcutId,
            {
                ...definition,
                keys: cloneShortcutKeys(definition.keys),
            },
        ]),
    );

    const resolveShortcut = (shortcutId: string, platform: ShortcutPlatform): ShortcutKeys | undefined => {
        const definition = registry.get(shortcutId);
        if (!definition) {
            return undefined;
        }
        if (Array.isArray(definition.keys)) {
            return definition.keys;
        }
        return definition.keys[platform] ?? definition.keys.default;
    };

    const registerShortcut = (shortcutId: string, definition: ShortcutDefinition) => {
        if (registry.has(shortcutId)) {
            console.warn(`Shortcut "${shortcutId}" is already registered; overwriting existing definition.`);
        }

        registry.set(shortcutId, {
            ...definition,
            keys: cloneShortcutKeys(definition.keys),
        });
    };

    const getShortcut = (shortcutId: string) => registry.get(shortcutId);

    const getShortcutKeys = (shortcutId: string, platform: ShortcutPlatform = 'default') => resolveShortcut(shortcutId, platform);

    const getShortcutText = (shortcutId: string, platform: ShortcutPlatform = 'default') => {
        const keys = resolveShortcut(shortcutId, platform);
        if (!keys) {
            return '';
        }
        return keys
            .map((combo) => combo.map((token) => displayToken(token, platform)).join('+'))
            .join(' / ');
    };

    const getAllShortcuts = () => Array.from(registry.entries()).map(([id, definition]) => ({ id, ...definition }));

    const getShortcutsByCategory = (category: string) =>
        getAllShortcuts().filter((shortcut) => shortcut.category === category);

    const listKeyboardShortcuts = (platform: ShortcutPlatform = isMacPlatform() ? 'mac' : 'default') =>
        getAllShortcuts().map(({ id, label, category }) => ({
            id,
            label,
            category,
            keys: resolveShortcut(id, platform) ?? [],
        }));

    return {
        registerShortcut,
        getShortcut,
        getShortcutKeys,
        getShortcutText,
        getAllShortcuts,
        getShortcutsByCategory,
        listKeyboardShortcuts,
    };
}

const shortcutRegistry = createShortcutRegistry();

export const registerShortcut = shortcutRegistry.registerShortcut;
export const getShortcut = shortcutRegistry.getShortcut;
export const getShortcutKeys = shortcutRegistry.getShortcutKeys;
export const getShortcutText = shortcutRegistry.getShortcutText;
export const getAllShortcuts = shortcutRegistry.getAllShortcuts;
export const getShortcutsByCategory = shortcutRegistry.getShortcutsByCategory;
export const listKeyboardShortcuts = shortcutRegistry.listKeyboardShortcuts;

export function requestSearchFocus(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    const event = new CustomEvent(SEARCH_FOCUS_EVENT, {
        bubbles: true,
        cancelable: true,
    });

    return !window.dispatchEvent(event);
}

export function useSearchFocusTarget(handler: () => void, enabled: Accessor<boolean> = () => true) {
    const handleFocusRequest = (event: Event) => {
        if (!enabled()) {
            return;
        }

        event.preventDefault();
        handler();
    };

    window.addEventListener(SEARCH_FOCUS_EVENT, handleFocusRequest);
    onCleanup(() => window.removeEventListener(SEARCH_FOCUS_EVENT, handleFocusRequest));
}

export function requestKeyboardAction(action: KeyboardAction): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    const event = new CustomEvent<{ action: KeyboardAction }>(KEYBOARD_ACTION_EVENT, {
        detail: { action },
        bubbles: true,
        cancelable: true,
    });

    return !window.dispatchEvent(event);
}

export function useKeyboardActionTarget(
    handlers: Partial<Record<KeyboardAction, () => void>>,
    enabled: Accessor<boolean> = () => true,
) {
    const handleAction = (event: Event) => {
        if (!enabled() || !(event instanceof CustomEvent)) {
            return;
        }

        const handler = handlers[event.detail.action as KeyboardAction];
        if (!handler) {
            return;
        }

        event.preventDefault();
        handler();
    };

    window.addEventListener(KEYBOARD_ACTION_EVENT, handleAction as EventListener);
    onCleanup(() => window.removeEventListener(KEYBOARD_ACTION_EVENT, handleAction as EventListener));
}

export function useSingleKeyShortcuts(options: SingleKeyShortcutOptions) {
    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.defaultPrevented) {
            return;
        }
        if (options.enabled && !options.enabled()) {
            return;
        }
        if (event.metaKey || event.ctrlKey || event.altKey || isEditableTarget(event.target)) {
            return;
        }

        const key = event.key.toLowerCase();
        const binding = options.bindings().find((item) => item.key.toLowerCase() === key);
        if (!binding) {
            return;
        }

        event.preventDefault();
        binding.action();
    };

    window.addEventListener('keydown', handleKeyDown);
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
}

export function useListNavigation<T>(options: ListNavigationOptions<T>) {
    const [selectedIndex, setSelectedIndex] = createSignal(0);
    const [selectedItemIds, setSelectedItemIds] = createSignal<string[]>([]);
    const itemRefs: ItemRefMap = {};

    createEffect(() => {
        const rows = options.items();
        if (rows.length === 0) {
            setSelectedIndex(0);
            setSelectedItemIds([]);
            return;
        }
        if (selectedIndex() >= rows.length) {
            setSelectedIndex(rows.length - 1);
        }

        const availableIds = new Set(rows.map((item, index) => getItemId(item, index)));
        setSelectedItemIds((prev) => prev.filter((itemId) => availableIds.has(itemId)));
    });

    createEffect(() => {
        const el = itemRefs[selectedIndex()];
        el?.scrollIntoView?.({ block: 'nearest' });
    });

    const setItemRef = (index: number, el: HTMLElement | undefined) => {
        itemRefs[index] = el;
    };

    const getItemId = (item: T, index: number) => String(options.getItemId ? options.getItemId(item, index) : index);

    const toggleSelection = () => {
        const item = options.items()[selectedIndex()];
        if (!item) {
            return;
        }

        const currentId = getItemId(item, selectedIndex());
        setSelectedItemIds((prev) =>
            prev.includes(currentId)
                ? prev.filter((itemId) => itemId !== currentId)
                : [...prev, currentId],
        );
    };

    const clearSelection = () => setSelectedItemIds([]);

    const isSelected = (item: T, index: number) => selectedItemIds().includes(getItemId(item, index));

    const moveSelection = (delta: number) => {
        const rows = options.items();
        if (rows.length === 0) {
            return;
        }
        setSelectedIndex((prev) => {
            const next = prev + delta;
            if (next < 0) {
                return 0;
            }
            if (next >= rows.length) {
                return rows.length - 1;
            }
            return next;
        });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.defaultPrevented) {
            return;
        }
        if (event.metaKey || event.ctrlKey || event.altKey) {
            return;
        }

        if (event.key === '/' && !isEditableTarget(event.target)) {
            event.preventDefault();
            options.onFocusSearch?.();
            return;
        }

        if (isEditableTarget(event.target)) {
            return;
        }

        switch (event.key) {
            case 'ArrowDown':
            case 'j':
                event.preventDefault();
                moveSelection(1);
                break;
            case 'ArrowUp':
            case 'k':
                event.preventDefault();
                moveSelection(-1);
                break;
            case 'Enter': {
                const item = options.items()[selectedIndex()];
                if (!item) {
                    return;
                }
                event.preventDefault();
                options.onOpen(item);
                break;
            }
            case 'c':
                if (options.onCreate) {
                    event.preventDefault();
                    options.onCreate();
                }
                break;
            case 'x':
                event.preventDefault();
                toggleSelection();
                break;
            case 'Escape':
                if (selectedItemIds().length > 0) {
                    event.preventDefault();
                    clearSelection();
                }
                break;
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown));

    return {
        selectedIndex,
        setSelectedIndex,
        setItemRef,
        selectedItemIds,
        clearSelection,
        isSelected,
    };
}

export function useChordShortcut(options: ChordShortcutOptions) {
    const [activeChord, setActiveChord] = createSignal<ChordState | null>(null);
    let resetTimer: ReturnType<typeof setTimeout> | undefined;

    const resetChord = () => {
        if (resetTimer) {
            clearTimeout(resetTimer);
            resetTimer = undefined;
        }
        setActiveChord(null);
    };

    const primeReset = () => {
        if (resetTimer) {
            clearTimeout(resetTimer);
        }
        resetTimer = setTimeout(() => setActiveChord(null), 1800);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.defaultPrevented) {
            return;
        }
        if (options.enabled && !options.enabled()) {
            resetChord();
            return;
        }
        if (event.metaKey || event.ctrlKey || event.altKey || isEditableTarget(event.target)) {
            return;
        }

        const key = event.key.toLowerCase();
        const bindings = options.bindings();
        const current = activeChord();

        if (!current) {
            const leaderBindings = bindings.filter((binding) => binding.leader.toLowerCase() === key);
            if (leaderBindings.length === 0) {
                return;
            }
            event.preventDefault();
            setActiveChord({
                leader: key,
                hints: leaderBindings.map((binding) => ({
                    key: binding.key,
                    description: binding.description,
                })),
            });
            primeReset();
            return;
        }

        const match = bindings.find((binding) =>
            binding.leader.toLowerCase() === current.leader.toLowerCase()
            && binding.key.toLowerCase() === key,
        );
        if (!match) {
            resetChord();
            return;
        }
        event.preventDefault();
        resetChord();
        match.action();
    };

    window.addEventListener('keydown', handleKeyDown);
    onCleanup(() => {
        window.removeEventListener('keydown', handleKeyDown);
        resetChord();
    });

    return {
        activeChord,
    };
}
