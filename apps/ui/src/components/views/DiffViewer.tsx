import { DiffFile as GitDiffFile, DiffModeEnum, DiffView, type DiffHighlighter } from "@git-diff-view/solid";
import { useStore } from "@nanostores/solid";
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { Copy, FileCode, MessageSquare } from "lucide-solid";
import { getDiffHighlighter } from "../../lib/diff-highlighter";
import {
    $collapsedDiffFiles,
    $diffViewMode,
    $diffWhitespaceMode,
    setDiffViewMode,
    setDiffWhitespaceMode,
    setCollapsedDiffFile,
    toggleDiffViewMode,
    type DiffViewMode,
    type DiffWhitespaceMode,
} from "../../stores/diff-preferences";
import DiffFileTree, { type DiffTreeFile } from "./DiffFileTree";
import DiffToolbar from "./DiffToolbar";
import InlineCommentForm from "./InlineCommentForm";
import "@git-diff-view/solid/styles/diff-view-pure.css";
import "./DiffViewer.css";

export interface RenderableDiffFile {
    id: string;
    path: string;
    old_path?: string;
    change_id?: string;
    change_type: string;
    patch: string;
    is_binary: boolean;
    language?: string;
    additions: number;
    deletions: number;
    old_content?: string;
    new_content?: string;
}

interface InlineComment {
    id: number;
    path: string;
    line: number;
    side: string;
    body: string;
    author: { login: string };
}

export interface DiffViewerProps {
    files: RenderableDiffFile[];
    isLoading?: boolean;
    errorMessage?: string | null;
    onRetry?: () => void;
    emptyMessage?: string;
    comments?: InlineComment[];
    landingId?: string;
    context?: { owner: string; repo: string };
    onCommentSubmitted?: () => void;
}

function isGeneratedDiffFile(path: string): boolean {
    const fileName = path.split("/").at(-1)?.toLowerCase() ?? path.toLowerCase();
    return fileName === "package-lock.json"
        || fileName === "pnpm-lock.yaml"
        || fileName === "bun.lock"
        || fileName === "go.sum"
        || fileName.endsWith(".min.js");
}

function splitPatchIntoHunks(patch: string): string[] {
    return patch
        .replace(/\r\n/g, "\n")
        .split(/\n(?=@@ )/)
        .filter((chunk) => chunk.startsWith("@@ "))
        .map((chunk) => (chunk.endsWith("\n") ? chunk : `${chunk}\n`));
}

function viewModeToEnum(mode: DiffViewMode): DiffModeEnum {
    return mode === "split" ? DiffModeEnum.SplitGitHub : DiffModeEnum.Unified;
}

function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    const tagName = target.tagName.toLowerCase();
    return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}

export default function DiffViewer(props: DiffViewerProps) {
    const viewMode = useStore($diffViewMode);
    const whitespaceMode = useStore($diffWhitespaceMode);
    const collapsedFiles = useStore($collapsedDiffFiles);
    const [activeFileId, setActiveFileId] = createSignal<string | null>(props.files[0]?.id ?? null);
    const [fileTreeWidth, setFileTreeWidth] = createSignal(280);
    const [highlighter, setHighlighter] = createSignal<DiffHighlighter | null>(null);

    const fileRefs = new Map<string, HTMLDivElement>();
    const diffInstances = new Map<string, GitDiffFile>();
    const hunkIndices = new Map<string, number>();
    let rootRef: HTMLDivElement | undefined;

    const totalAdditions = createMemo(() => props.files.reduce((sum, file) => sum + file.additions, 0));
    const totalDeletions = createMemo(() => props.files.reduce((sum, file) => sum + file.deletions, 0));
    const visibleFiles = createMemo(() => props.files);
    const treeFiles = createMemo<DiffTreeFile[]>(() =>
        props.files.map((file) => ({
            id: file.id,
            path: file.path,
            changeType: file.change_type,
            additions: file.additions,
            deletions: file.deletions,
            collapsed: collapsedFiles()[file.id] ?? isGeneratedDiffFile(file.path),
            generated: isGeneratedDiffFile(file.path),
        }))
    );

    const focusRoot = () => rootRef?.focus();

    const scrollToFile = (fileId: string) => {
        const element = fileRefs.get(fileId);
        if (!element) {
            return;
        }

        setActiveFileId(fileId);
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        focusRoot();
    };

    const navigateFiles = (direction: 1 | -1) => {
        const files = visibleFiles();
        if (!files.length) {
            return;
        }

        const currentIndex = files.findIndex((file) => file.id === activeFileId());
        const nextIndex = currentIndex < 0
            ? 0
            : Math.min(files.length - 1, Math.max(0, currentIndex + direction));

        scrollToFile(files[nextIndex].id);
    };

    const navigateHunks = (direction: 1 | -1) => {
        const fileId = activeFileId();
        if (!fileId) {
            return;
        }

        const container = fileRefs.get(fileId);
        if (!container) {
            return;
        }

        const hunks = Array.from(container.querySelectorAll<HTMLElement>('tr[data-state="hunk"]'));
        if (!hunks.length) {
            return;
        }

        const current = hunkIndices.get(fileId) ?? (direction > 0 ? -1 : hunks.length);
        const next = Math.min(hunks.length - 1, Math.max(0, current + direction));
        hunkIndices.set(fileId, next);
        hunks[next]?.scrollIntoView({ behavior: "smooth", block: "center" });
        focusRoot();
    };

    const onExpandAll = () => {
        const mode = viewMode();
        for (const instance of diffInstances.values()) {
            instance.onAllExpand(mode);
        }
    };

    const onCollapseAll = () => {
        const mode = viewMode();
        for (const instance of diffInstances.values()) {
            instance.onAllCollapse(mode);
        }
    };

    const onKeyDown = (event: KeyboardEvent) => {
        if (isEditableTarget(event.target)) {
            return;
        }

        switch (event.key) {
            case "j":
                event.preventDefault();
                navigateFiles(1);
                break;
            case "k":
                event.preventDefault();
                navigateFiles(-1);
                break;
            case "n":
                event.preventDefault();
                navigateHunks(1);
                break;
            case "p":
                event.preventDefault();
                navigateHunks(-1);
                break;
            case "v":
                event.preventDefault();
                toggleDiffViewMode();
                break;
        }
    };

    createEffect(() => {
        const firstFileId = props.files[0]?.id ?? null;
        if (!activeFileId() || !props.files.some((file) => file.id === activeFileId())) {
            setActiveFileId(firstFileId);
        }
    });

    onMount(() => {
        void getDiffHighlighter()
            .then(setHighlighter)
            .catch(() => setHighlighter(null));
    });

    return (
        <div
            ref={rootRef}
            class="diff-review"
            tabindex={0}
            onClick={focusRoot}
            onKeyDown={(event) => onKeyDown(event)}
        >
            <Show when={props.isLoading}>
                <div class="diff-review-state">Loading diff…</div>
            </Show>

            <Show when={props.errorMessage}>
                {(message) => (
                    <div class="diff-review-state is-error">
                        <span>{message()}</span>
                        <Show when={props.onRetry}>
                            <button class="diff-review-retry" type="button" onClick={props.onRetry}>
                                Retry
                            </button>
                        </Show>
                    </div>
                )}
            </Show>

            <Show when={!props.isLoading && !props.errorMessage && props.files.length === 0}>
                <div class="diff-review-state">{props.emptyMessage ?? "No changes."}</div>
            </Show>

            <Show when={!props.isLoading && !props.errorMessage && props.files.length > 0}>
                <div class="diff-review-summary">
                    <div>
                        <span class="diff-review-summary-value">{props.files.length}</span>
                        <span class="diff-review-summary-label">changed files</span>
                    </div>
                    <div>
                        <span class="diff-review-summary-value is-add">+{totalAdditions()}</span>
                        <span class="diff-review-summary-label">additions</span>
                    </div>
                    <div>
                        <span class="diff-review-summary-value is-del">-{totalDeletions()}</span>
                        <span class="diff-review-summary-label">deletions</span>
                    </div>
                </div>

                <DiffToolbar
                    viewMode={viewMode()}
                    whitespaceMode={whitespaceMode()}
                    onViewModeChange={(mode) => setDiffViewMode(mode)}
                    onWhitespaceModeChange={(mode) => setDiffWhitespaceMode(mode)}
                    onExpandAll={onExpandAll}
                    onCollapseAll={onCollapseAll}
                />

                <div class="diff-review-layout">
                    <DiffFileTree
                        files={treeFiles()}
                        activeFileId={activeFileId()}
                        width={fileTreeWidth()}
                        onWidthChange={setFileTreeWidth}
                        onFileSelect={scrollToFile}
                    />

                    <div class="diff-review-files">
                        <For each={props.files}>
                            {(file) => (
                                <DiffFileSection
                                    file={file}
                                    viewMode={viewMode()}
                                    collapsed={collapsedFiles()[file.id] ?? isGeneratedDiffFile(file.path)}
                                    highlighter={highlighter()}
                                    onSetActive={() => setActiveFileId(file.id)}
                                    onToggleCollapse={() => setCollapsedDiffFile(file.id, !(collapsedFiles()[file.id] ?? isGeneratedDiffFile(file.path)))}
                                    onCopy={() => void navigator.clipboard?.writeText(file.patch)}
                                    registerDiffInstance={(instance) => {
                                        if (instance) {
                                            diffInstances.set(file.id, instance);
                                        } else {
                                            diffInstances.delete(file.id);
                                        }
                                    }}
                                    registerFileRef={(element) => {
                                        if (element) {
                                            fileRefs.set(file.id, element);
                                        } else {
                                            fileRefs.delete(file.id);
                                        }
                                    }}
                                    comments={props.comments?.filter(c => c.path === file.path)}
                                    landingId={props.landingId}
                                    context={props.context}
                                    onCommentSubmitted={props.onCommentSubmitted}
                                />
                            )}
                        </For>
                    </div>
                </div>
            </Show>
        </div>
    );
}

interface DiffFileSectionProps {
    file: RenderableDiffFile;
    viewMode: DiffViewMode;
    collapsed: boolean;
    highlighter: DiffHighlighter | null;
    onSetActive: () => void;
    onToggleCollapse: () => void;
    onCopy: () => void;
    registerDiffInstance: (instance: GitDiffFile | null) => void;
    registerFileRef: (element: HTMLDivElement | undefined) => void;
    comments?: InlineComment[];
    landingId?: string;
    context?: { owner: string; repo: string };
    onCommentSubmitted?: () => void;
}

function DiffFileSection(props: DiffFileSectionProps) {
    let sectionRef: HTMLDivElement | undefined;
    const [activeWidget, setActiveWidget] = createSignal<{ line: number; side: "left" | "right" } | null>(null);

    const extendData = createMemo(() => {
        const data: Record<string, { data: InlineComment[] }> = {};
        props.comments?.forEach((comment) => {
            const key = `${comment.side === 'left' ? 'old' : 'new'}-${comment.line}`;
            if (!data[key]) {
                data[key] = { data: [] };
            }
            data[key].data.push(comment);
        });
        return data;
    });

    const diffFile = createMemo(() => {
        if (props.file.is_binary) {
            return null;
        }

        const instance = new GitDiffFile(
            props.file.old_path || props.file.path,
            props.file.old_content || "",
            props.file.path,
            props.file.new_content || "",
            splitPatchIntoHunks(props.file.patch),
            props.file.language || "",
            props.file.language || "",
            props.file.id,
        );

        instance.initTheme("dark");
        instance.initRaw();
        if (props.highlighter) {
            instance.initSyntax({ registerHighlighter: props.highlighter });
        }
        instance.buildSplitDiffLines();
        instance.buildUnifiedDiffLines();
        return instance;
    });

    createEffect(() => {
        props.registerFileRef(sectionRef);
    });

    createEffect(() => {
        props.registerDiffInstance(diffFile());
    });

    onCleanup(() => {
        props.registerFileRef(undefined);
        props.registerDiffInstance(null);
    });

    const changeLabel = createMemo(() => {
        const label = props.file.change_type;
        return props.file.change_id ? `${label} · ${props.file.change_id}` : label;
    });

    return (
        <section
            ref={sectionRef}
            class={`diff-file-section ${props.collapsed ? "is-collapsed" : ""}`}
            onFocusIn={props.onSetActive}
            onMouseEnter={props.onSetActive}
        >
            <div class="diff-file-header">
                <button class="diff-file-toggle" type="button" onClick={props.onToggleCollapse}>
                    <FileCode size={15} />
                    <span class="diff-file-path">{props.file.path}</span>
                </button>
                <div class="diff-file-meta">
                    <span class="diff-file-change">{changeLabel()}</span>
                    <span class="diff-file-stats is-add">+{props.file.additions}</span>
                    <span class="diff-file-stats is-del">-{props.file.deletions}</span>
                    <button class="diff-file-copy" type="button" onClick={props.onCopy} aria-label={`Copy diff for ${props.file.path}`}>
                        <Copy size={14} />
                    </button>
                </div>
            </div>

            <Show when={!props.collapsed}>
                <div class="diff-file-body">
                    <Show when={!props.file.is_binary} fallback={<div class="diff-file-empty">Binary file changed.</div>}>
                        <Show when={diffFile()} fallback={<div class="diff-file-empty">No visible hunks.</div>}>
                            {(instance) => (
                                <DiffView
                                    diffFile={instance()}
                                    diffViewMode={viewModeToEnum(props.viewMode)}
                                    diffViewTheme="dark"
                                    diffViewHighlight={Boolean(props.highlighter)}
                                    diffViewAddWidget={true}
                                    onAddWidgetClick={(lineNumber, side) => {
                                        setActiveWidget({
                                            line: lineNumber,
                                            side: side === 1 ? 'left' : 'right'
                                        });
                                    }}
                                    renderWidgetLine={(widgetProps) => (
                                        <Show when={activeWidget()?.line === widgetProps.lineNumber && activeWidget()?.side === (widgetProps.side === 1 ? 'left' : 'right')}>
                                            <InlineCommentForm
                                                landingId={props.landingId!}
                                                context={props.context!}
                                                path={props.file.path}
                                                line={widgetProps.lineNumber}
                                                side={widgetProps.side === 1 ? 'left' : 'right'}
                                                onSubmitted={() => {
                                                    props.onCommentSubmitted?.();
                                                    setActiveWidget(null);
                                                }}
                                                onClose={() => setActiveWidget(null)}
                                            />
                                        </Show>
                                    )}
                                    extendData={extendData()}
                                    renderExtendLine={(extendProps) => (
                                        <div class="inline-comments-container flex flex-col gap-2 p-4 bg-app/50 border-y border-border/50">
                                            <For each={extendProps.data as InlineComment[]}>
                                                {(comment) => (
                                                    <div class="inline-comment-bubble bg-panel border border-border p-3 rounded-md shadow-sm">
                                                        <div class="flex items-center gap-2 mb-1">
                                                            <span class="font-semibold text-xs">{comment.author.login}</span>
                                                        </div>
                                                        <div class="text-sm whitespace-pre-wrap">{comment.body}</div>
                                                    </div>
                                                )}
                                            </For>
                                        </div>
                                    )}
                                />
                            )}
                        </Show>
                    </Show>
                </div>
            </Show>
        </section>
    );
}
