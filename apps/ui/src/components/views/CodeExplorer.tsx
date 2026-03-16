import { useParams, useSearchParams } from "@solidjs/router";
import { useStore } from '@nanostores/solid';
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import {
    ChevronRight,
    File,
    FileCode,
    FileImage,
    FileJson,
    FileText,
    Folder,
    PencilLine,
    Search,
} from 'lucide-solid';
import EditorTabs from '../editor/EditorTabs';
import FilePreview, { detectLanguageForPath, detectPreviewKind, type FilePreviewKind } from '../editor/FilePreview';
import {
    $activeTab,
    $dirtyFiles,
    $openTabs,
    closeEditorTab,
    resetEditorState,
    setActiveEditorTab,
    setDirtyFile,
    upsertEditorTab,
} from '../../lib/editorState';
import { featureFlags } from '../../lib/featureFlags';
import {
    buildLocalBufferKey,
    cleanupStaleBufferedContent,
    clearBufferedContent,
    getBufferedContent,
    queueBufferedWrite,
} from '../../lib/localStorageBuffer';
import {
    repoContentsResource,
    repoFileResource,
    type ContentEntry,
    type RepoFileResponse,
} from '../../lib/navigationData';
import { createHoverPrefetchHandlers } from '../../lib/prefetchCache';
import { $editorFontSize, $editorTheme } from '../../stores/workbench';
import './CodeExplorer.css';

type OpenFileState = {
    path: string;
    content: string;
    originalContent: string;
    language: string;
    previewType: FilePreviewKind;
    isLoading: boolean;
    error: string | null;
};

function decodeContent(content: unknown, encoding: unknown): string {
    if (typeof content !== 'string') {
        return '';
    }
    if (encoding === 'base64') {
        try {
            return atob(content);
        } catch {
            return content;
        }
    }
    return content;
}

function fileName(path: string): string {
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1] ?? path;
}

function parentDirectory(path: string): string {
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    return parts.join('/');
}

function getFileIcon(name: string) {
    const lower = name.toLowerCase();
    if (lower.endsWith('.json')) return <FileJson size={14} class="text-yellow" />;
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.svg') || lower.endsWith('.gif')) {
        return <FileImage size={14} class="text-cyan" />;
    }
    if (lower.endsWith('.md') || lower.endsWith('.txt')) return <FileText size={14} class="text-muted" />;
    if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return <FileCode size={14} class="text-blue" />;
    if (lower.endsWith('.js') || lower.endsWith('.jsx')) return <FileCode size={14} class="text-yellow" />;
    if (lower.endsWith('.go')) return <FileCode size={14} class="text-cyan" />;
    if (lower.endsWith('.rs')) return <FileCode size={14} class="text-orange" />;
    return <File size={14} class="text-muted" />;
}

export default function CodeExplorer() {
    const params = useParams<{ owner: string; repo: string }>();
    const [searchParams, setSearchParams] = useSearchParams<{ ref?: string; path?: string }>();
    const $tabs = useStore($openTabs);
    const $selectedTab = useStore($activeTab);
    const $dirty = useStore($dirtyFiles);
    const $flags = useStore(featureFlags);
    const $theme = useStore($editorTheme);
    const $fontSize = useStore($editorFontSize);

    const ctx = () => ({ owner: params.owner ?? "", repo: params.repo ?? "" });
    const repoName = () => ctx().repo || 'repo';
    const selectedRef = createMemo(() => searchParams.ref?.trim() ?? '');
    const requestedPath = createMemo(() => searchParams.path?.trim() ?? '');

    const [entries, setEntries] = createSignal<ContentEntry[]>([]);
    const [currentPath, setCurrentPath] = createSignal('');
    const [isLoadingEntries, setIsLoadingEntries] = createSignal(true);
    const [entryError, setEntryError] = createSignal<string | null>(null);
    const [searchQuery, setSearchQuery] = createSignal('');
    const [fileStates, setFileStates] = createSignal<Record<string, OpenFileState>>({});
    const [editableFiles, setEditableFiles] = createSignal<Set<string>>(new Set());
    const [statusMessage, setStatusMessage] = createSignal<string | null>(null);

    const webEditorEnabled = createMemo(() => $flags().web_editor);

    const filteredEntries = createMemo(() => {
        const query = searchQuery().trim().toLowerCase();
        if (!query) {
            return entries();
        }
        return entries().filter((entry) => entry.name.toLowerCase().includes(query));
    });

    const activeTab = createMemo(() => {
        const activeId = $selectedTab();
        return $tabs().find((tab) => tab.id === activeId) ?? null;
    });

    const activeFile = createMemo(() => {
        const tab = activeTab();
        return tab ? fileStates()[tab.path] ?? null : null;
    });

    const activePathParts = createMemo(() => {
        const targetPath = activeTab()?.path ?? currentPath();
        return targetPath.split('/').filter(Boolean);
    });

    const activePreviewLabel = createMemo(() => {
        const kind = activeFile()?.previewType;
        switch (kind) {
            case 'markdown':
                return 'Markdown';
            case 'image':
                return 'Image';
            case 'pdf':
                return 'PDF';
            case 'binary':
                return 'Binary';
            default:
                return 'Code';
        }
    });

    const canEditActiveFile = createMemo(() => {
        const state = activeFile();
        return webEditorEnabled() && Boolean(state && (state.previewType === 'code' || state.previewType === 'markdown'));
    });

    const isActiveFileEditable = createMemo(() => {
        const tab = activeTab();
        return Boolean(tab && editableFiles().has(tab.path));
    });

    const syncExplorerLocation = (path: string) => {
        setSearchParams({
            ref: selectedRef() || undefined,
            path: path || undefined,
        }, { replace: true });
    };

    const buildContentsRequest = (path: string) => {
        const ref = selectedRef();
        return {
            path,
            ref,
        };
    };

    const sortEntries = (items: ContentEntry[]) => {
        return [...items].sort((a, b) => {
            if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
    };

    const hydrateFileState = (path: string, data: RepoFileResponse) => {
        const language = detectLanguageForPath(path);
        const serverContent = decodeContent(data.content, data.encoding);
        const bufferKey = buildLocalBufferKey(ctx(), path);
        const bufferedContent = getBufferedContent(bufferKey);
        const resolvedContent = bufferedContent ?? serverContent;
        const resolvedPreviewType = detectPreviewKind(path, resolvedContent);
        const isDirty = bufferedContent != null && bufferedContent !== serverContent;

        setDirtyFile(path, isDirty);
        updateOpenFileState(path, {
            content: resolvedContent,
            originalContent: serverContent,
            language,
            previewType: resolvedPreviewType,
            isLoading: false,
            error: null,
        });

        return {
            language,
            previewType: resolvedPreviewType,
        };
    };

    const fetchDirectory = async (path: string, options: { syncUrl?: boolean } = {}) => {
        const request = buildContentsRequest(path);
        const cachedEntries = repoContentsResource.peek(ctx(), request.path, request.ref);
        if (cachedEntries) {
            setEntries(sortEntries(cachedEntries));
            setCurrentPath(path);
            if (options.syncUrl !== false) {
                syncExplorerLocation(path);
            }
        }

        setIsLoadingEntries(!cachedEntries);
        setEntryError(null);
        try {
            const items = await repoContentsResource.load(ctx(), request.path, request.ref);
            setEntries(sortEntries(items));
            setCurrentPath(path);
            if (options.syncUrl !== false) {
                syncExplorerLocation(path);
            }
        } catch (error) {
            setEntryError(error instanceof Error ? error.message : 'Failed to load contents');
        } finally {
            setIsLoadingEntries(false);
        }
    };

    const updateOpenFileState = (path: string, nextState: Partial<OpenFileState>) => {
        setFileStates((prev) => ({
            ...prev,
            [path]: Object.assign({
                path,
                content: '',
                originalContent: '',
                language: detectLanguageForPath(path),
                previewType: detectPreviewKind(path),
                isLoading: false,
                error: null,
            }, prev[path], nextState),
        }));
    };

    const openFile = async (path: string, options: { syncUrl?: boolean } = {}): Promise<boolean> => {
        const title = fileName(path);
        const request = buildContentsRequest(path);

        setStatusMessage(null);

        const existing = fileStates()[path];
        if (existing && !existing.isLoading && !existing.error) {
            upsertEditorTab({
                id: path,
                path,
                title,
                language: existing.language,
                previewType: existing.previewType,
            });
            if (options.syncUrl !== false) {
                syncExplorerLocation(path);
            }
            return true;
        }

        const cachedFile = repoFileResource.peek(ctx(), request.path, request.ref);
        if (cachedFile) {
            const hydrated = hydrateFileState(path, cachedFile);
            upsertEditorTab({
                id: path,
                path,
                title,
                language: hydrated.language,
                previewType: hydrated.previewType,
            });
            if (options.syncUrl !== false) {
                syncExplorerLocation(path);
            }
            return true;
        }

        updateOpenFileState(path, {
            isLoading: true,
            error: null,
        });

        try {
            const data = await repoFileResource.load(ctx(), request.path, request.ref);
            const hydrated = hydrateFileState(path, data);

            upsertEditorTab({
                id: path,
                path,
                title,
                language: hydrated.language,
                previewType: hydrated.previewType,
            });
            if (options.syncUrl !== false) {
                syncExplorerLocation(path);
            }
            return true;
        } catch (error) {
            updateOpenFileState(path, {
                isLoading: false,
                error: error instanceof Error ? error.message : 'Failed to load file',
            });
            return false;
        }
    };

    const handleEntryClick = (entry: ContentEntry) => {
        if (entry.type === 'dir') {
            setActiveEditorTab(null);
            void fetchDirectory(entry.path);
            return;
        }
        void openFile(entry.path);
    };

    const handleContentChange = (path: string, nextContent: string) => {
        const state = fileStates()[path];
        if (!state) {
            return;
        }

        updateOpenFileState(path, {
            content: nextContent,
        });

        const isDirty = nextContent !== state.originalContent;
        const bufferKey = buildLocalBufferKey(ctx(), path);

        if (isDirty) {
            queueBufferedWrite(bufferKey, nextContent, path);
            setDirtyFile(path, true);
        } else {
            clearBufferedContent(bufferKey, path);
        }
    };

    const handleSave = () => {
        const tab = activeTab();
        const state = activeFile();
        if (!tab || !state) {
            return;
        }

        if (state.content === state.originalContent) {
            setStatusMessage('No local changes to save.');
            return;
        }

        const bufferKey = buildLocalBufferKey(ctx(), tab.path);
        queueBufferedWrite(bufferKey, state.content, tab.path, 0);
        setStatusMessage('Local draft saved in the browser. Server-side commit flow is not wired yet.');
    };

    const toggleEditMode = () => {
        const tab = activeTab();
        if (!tab) {
            return;
        }
        setEditableFiles((prev) => {
            const next = new Set(prev);
            if (next.has(tab.path)) {
                next.delete(tab.path);
            } else {
                next.add(tab.path);
            }
            return next;
        });
    };

    const handleCloseTab = (tabId: string) => {
        const path = tabId;
        const wasActive = $selectedTab() === tabId;
        closeEditorTab(tabId);
        setEditableFiles((prev) => {
            const next = new Set(prev);
            next.delete(path);
            return next;
        });
        setDirtyFile(path, false);

        if (wasActive) {
            syncExplorerLocation($activeTab.get() ?? currentPath());
        }
    };

    const navigateUp = () => {
        const parts = currentPath().split('/').filter(Boolean);
        parts.pop();
        setActiveEditorTab(null);
        void fetchDirectory(parts.join('/'));
    };

    onMount(() => {
        resetEditorState();
        cleanupStaleBufferedContent();
    });

    onCleanup(() => {
        resetEditorState();
    });

    let lastAppliedKey = '';
    createEffect(() => {
        const owner = ctx().owner;
        const repo = ctx().repo;
        const ref = selectedRef();
        const path = requestedPath();

        if (!owner || !repo) {
            return;
        }

        const repoRefKey = `${owner}/${repo}?ref=${ref}`;
        const fullKey = `${repoRefKey}&path=${path}`;

        // Same exact state already applied — nothing to do
        if (fullKey === lastAppliedKey) {
            return;
        }

        const repoRefChanged = lastAppliedKey !== '' && !lastAppliedKey.startsWith(repoRefKey);
        if (repoRefChanged) {
            resetEditorState();
            setFileStates({});
            setEditableFiles(new Set<string>());
            setStatusMessage(null);
        }

        lastAppliedKey = fullKey;

        void (async () => {
            if (!path) {
                setActiveEditorTab(null);
                await fetchDirectory('', { syncUrl: false });
                return;
            }

            const directoryPath = parentDirectory(path);
            await fetchDirectory(directoryPath, { syncUrl: false });

            const targetFile = await openFile(path, { syncUrl: false });
            if (!targetFile) {
                setActiveEditorTab(null);
                await fetchDirectory(path, { syncUrl: false });
            }
        })();
    });

    return (
        <div class="explorer-container">
            <div class="explorer-sidebar">
                <div class="explorer-header">
                    <span class="explorer-title">EXPLORER</span>
                    <div class="explorer-search">
                        <Search size={14} class="explorer-search-icon" />
                        <input
                            type="search"
                            class="explorer-search-input"
                            placeholder="Filter current folder"
                            value={searchQuery()}
                            onInput={(event) => setSearchQuery(event.currentTarget.value)}
                        />
                    </div>
                </div>

                <div class="file-tree">
                    <div class="tree-root-item">{repoName()}</div>

                    <Show when={currentPath()}>
                        <button type="button" class="tree-file tree-parent-link" onClick={navigateUp}>
                            <span class="text-muted">..</span>
                        </button>
                    </Show>

                    <Show when={isLoadingEntries()}>
                        <div class="tree-status text-muted">Loading files…</div>
                    </Show>

                    <Show when={entryError()}>
                        {(message) => <div class="tree-status text-red">{message()}</div>}
                    </Show>

                    <For each={filteredEntries()}>
                        {(entry) => {
                            const prefetchHandlers = createHoverPrefetchHandlers(() =>
                                entry.type === 'dir'
                                    ? repoContentsResource.prefetch(ctx(), entry.path, selectedRef())
                                    : repoFileResource.prefetch(ctx(), entry.path, selectedRef()),
                            );

                            return (
                                <button
                                    type="button"
                                    class={`tree-file ${activeTab()?.path === entry.path ? 'active' : ''}`}
                                    onMouseEnter={prefetchHandlers.onMouseEnter}
                                    onMouseLeave={prefetchHandlers.onMouseLeave}
                                    onFocus={prefetchHandlers.onFocus}
                                    onBlur={prefetchHandlers.onBlur}
                                    onClick={() => handleEntryClick(entry)}
                                >
                                    <Show when={entry.type === 'dir'} fallback={getFileIcon(entry.name)}>
                                        <Folder size={14} class="text-blue" />
                                    </Show>
                                    <span>{entry.name}</span>
                                </button>
                            );
                        }}
                    </For>

                    <Show when={!isLoadingEntries() && !entryError() && filteredEntries().length === 0}>
                        <div class="tree-status text-muted">No files match this filter.</div>
                    </Show>
                </div>
            </div>

            <div class="editor-area">
                <Show when={$tabs().length > 0}>
                    <EditorTabs
                        tabs={$tabs()}
                        activeTabId={$selectedTab()}
                        dirtyFiles={$dirty()}
                        onSelect={(tabId) => {
                            setActiveEditorTab(tabId);
                            syncExplorerLocation(tabId);
                        }}
                        onClose={handleCloseTab}
                    />
                </Show>

                <Show when={currentPath() || activeTab()}>
                    <div class="editor-breadcrumbs">
                        <button
                            type="button"
                            class="crumb cursor-pointer"
                            onClick={() => {
                                setActiveEditorTab(null);
                                void fetchDirectory('');
                            }}
                        >
                            {repoName()}
                        </button>
                        <For each={activePathParts()}>
                            {(part, index) => {
                                const isLast = () => index() === activePathParts().length - 1;
                                const targetPath = () => activePathParts().slice(0, index() + 1).join('/');
                                const isFileCrumb = () => Boolean(activeTab()) && isLast();
                                return (
                                    <>
                                        <ChevronRight size={12} class="crumb-sep" />
                                        <button
                                            type="button"
                                            class={`crumb ${isLast() ? 'font-semibold' : 'cursor-pointer'}`}
                                            disabled={isFileCrumb()}
                                            onClick={() => {
                                                if (!isFileCrumb()) {
                                                    setActiveEditorTab(null);
                                                    void fetchDirectory(targetPath());
                                                }
                                            }}
                                        >
                                            {part}
                                        </button>
                                    </>
                                );
                            }}
                        </For>
                    </div>
                </Show>

                <Show when={activeTab()}>
                    <div class="editor-toolbar">
                        <div class="editor-toolbar-meta">
                            <span class="editor-mode-pill">{activePreviewLabel()}</span>
                            <Show when={canEditActiveFile()}>
                                <span class="editor-mode-pill secondary">
                                    {isActiveFileEditable() ? 'Editable' : 'Read-only'}
                                </span>
                            </Show>
                            <Show when={!webEditorEnabled()}>
                                <span class="editor-toolbar-note">`web_editor` is disabled, using the plain text fallback.</span>
                            </Show>
                        </div>
                        <div class="editor-actions">
                            <Show when={canEditActiveFile()}>
                                <button type="button" class="btn" onClick={toggleEditMode}>
                                    <PencilLine size={14} />
                                    {isActiveFileEditable() ? 'Lock' : 'Edit'}
                                </button>
                            </Show>
                        </div>
                    </div>
                </Show>

                <Show when={statusMessage()}>
                    {(message) => <div class="editor-status-banner">{message()}</div>}
                </Show>

                <div class={`editor-content ${activeTab() ? '' : 'is-empty'}`}>
                    <Show
                        when={activeTab() && activeFile()}
                        fallback={
                            <Show when={!isLoadingEntries() && !entryError()}>
                                <div class="empty-state">
                                    <div class="empty-state-card">
                                        <FileCode size={28} class="empty-state-icon" />
                                    </div>
                                    <p class="text-secondary font-medium">Select a file to view its contents</p>
                                </div>
                            </Show>
                        }
                    >
                        {(state) => (
                            <Show
                                when={!state().isLoading}
                                fallback={<div class="editor-loading-skeleton">Loading file…</div>}
                            >
                                <Show
                                    when={!state().error}
                                    fallback={<div class="file-preview-placeholder">{state().error}</div>}
                                >
                                    <FilePreview
                                        path={state().path}
                                        content={state().content}
                                        language={state().language}
                                        monacoEnabled={webEditorEnabled()}
                                        readOnly={!isActiveFileEditable()}
                                        theme={$theme()}
                                        fontSize={$fontSize()}
                                        onChange={(next) => handleContentChange(state().path, next)}
                                        onSave={handleSave}
                                    />
                                </Show>
                            </Show>
                        )}
                    </Show>
                </div>
            </div>
        </div>
    );
}
