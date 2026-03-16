import { useStore } from "@nanostores/solid";
import { ChevronDown, ChevronRight, File as FileIcon, FileDiff, Minus, Plus } from "lucide-solid";
import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import MonacoDiffEditor from "../editor/MonacoDiffEditor";
import { detectLanguageForPath } from "../editor/FilePreview";
import { featureFlags } from "../../lib/featureFlags";
import { repoApiFetch } from "../../lib/repoContext";
import { $diffWhitespaceMode } from "../../stores/diff-preferences";
import { $editorTheme, type EditorThemePreference } from "../../stores/workbench";
import DiffViewer, { type RenderableDiffFile } from "./DiffViewer";

interface ChangeDiffContentProps {
    changeId: string;
    repoContext: { owner: string; repo: string };
}

interface ChangeDiffResponse {
    change_id: string;
    file_diffs: Array<{
        path: string;
        old_path?: string;
        change_type: string;
        patch: string;
        is_binary: boolean;
        language?: string;
        additions: number;
        deletions: number;
        old_content?: string;
        new_content?: string;
    }>;
}

export default function ChangeDiffContent(props: ChangeDiffContentProps) {
    const $flags = useStore(featureFlags);
    const $theme = useStore($editorTheme);
    const whitespaceMode = useStore($diffWhitespaceMode);
    const [files, setFiles] = createSignal<RenderableDiffFile[]>([]);
    const [isLoading, setIsLoading] = createSignal(true);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [inlineMode, setInlineMode] = createSignal(false);
    const [preferFallback, setPreferFallback] = createSignal(false);

    const loadDiff = async () => {
        setIsLoading(true);
        setErrorMessage(null);

        const whitespace = whitespaceMode();
        const suffix = whitespace === "ignore" ? "?whitespace=ignore" : "";

        performance.mark("diff-fetch-start");
        try {
            const response = await repoApiFetch(`/changes/${props.changeId}/diff${suffix}`, {}, props.repoContext);
            if (!response.ok) {
                throw new Error(`Failed to load diff (${response.status})`);
            }

            const body = await response.json() as ChangeDiffResponse;
            setFiles((body.file_diffs ?? []).map((file) => ({
                ...file,
                change_id: body.change_id,
                id: `${body.change_id}:${file.path}`,
            })));
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to load diff");
            setFiles([]);
        } finally {
            performance.mark("diff-fetch-end");
            performance.measure("diff-fetch", "diff-fetch-start", "diff-fetch-end");
            setIsLoading(false);
        }
    };

    createEffect(() => {
        whitespaceMode();
        void loadDiff();
    });

    onMount(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
            return;
        }

        const mediaQuery = window.matchMedia("(max-width: 960px)");
        const applyPreference = () => setPreferFallback(mediaQuery.matches);
        applyPreference();
        mediaQuery.addEventListener?.("change", applyPreference);
        onCleanup(() => mediaQuery.removeEventListener?.("change", applyPreference));
    });

    const usingMonaco = () => $flags().web_editor && !preferFallback();

    return (
        <div class="change-diff-content p-4 bg-panel border-t border-border mt-2 rounded-b-md">
            <Show
                when={usingMonaco()}
                fallback={
                    <DiffViewer
                        files={files()}
                        isLoading={isLoading()}
                        errorMessage={errorMessage()}
                        onRetry={() => void loadDiff()}
                        emptyMessage="No changes in this change."
                    />
                }
            >
                <Show when={isLoading()}>
                    <p class="text-muted text-sm px-2">Loading diff...</p>
                </Show>
                <Show when={errorMessage()}>
                    {(message) => <p class="text-red text-sm px-2">{message()}</p>}
                </Show>
                <Show when={!isLoading() && !errorMessage() && files().length === 0}>
                    <p class="text-muted text-sm px-2">No changes in this change.</p>
                </Show>
                <Show when={!isLoading() && !errorMessage() && files().length > 0}>
                    <div class="diff-wrapper">
                        <div class="diff-summary text-sm flex gap-4 text-muted mb-4 px-2 items-center flex-wrap">
                            <span><FileDiff size={14} class="inline mr-1" /> {files().length} changed files</span>
                            <span class="text-green flex items-center"><Plus size={14} class="mr-1" /> {files().reduce((total, file) => total + file.additions, 0)} lines</span>
                            <span class="text-red flex items-center"><Minus size={14} class="mr-1" /> {files().reduce((total, file) => total + file.deletions, 0)} lines</span>
                            <button type="button" class="btn ml-auto" onClick={() => setInlineMode(!inlineMode())}>
                                {inlineMode() ? "Side-by-side diff" : "Inline diff"}
                            </button>
                        </div>

                        <div class="diff-files flex flex-col gap-4">
                            <For each={files()}>
                                {(file) => (
                                    <MonacoFileDiffCard
                                        file={file}
                                        inline={inlineMode()}
                                        theme={$theme()}
                                    />
                                )}
                            </For>
                        </div>
                    </div>
                </Show>
            </Show>
        </div>
    );
}

interface MonacoFileDiffCardProps {
    file: RenderableDiffFile;
    inline: boolean;
    theme: EditorThemePreference;
}

function MonacoFileDiffCard(props: MonacoFileDiffCardProps) {
    const [expanded, setExpanded] = createSignal(false);
    const [monacoFailed, setMonacoFailed] = createSignal(false);

    const toggleExpand = () => {
        if (!document.startViewTransition) {
            setExpanded(!expanded());
            return;
        }

        document.startViewTransition(() => {
            setExpanded(!expanded());
        });
    };

    const fallbackText = () => props.file.patch || props.file.new_content || props.file.old_content || "No visible hunks.";

    return (
        <div class="file-diff-item border border-border rounded-md overflow-hidden animate-in transition-all delay-75">
            <div
                class="file-diff-header flex items-center p-2 bg-secondary cursor-pointer hover:bg-hover select-none sticky top-0 z-10"
                onClick={toggleExpand}
            >
                {expanded() ? <ChevronDown size={16} class="mr-2 text-muted" /> : <ChevronRight size={16} class="mr-2 text-muted" />}
                <FileIcon size={16} class="mr-2 text-muted" />
                <span class="font-mono text-sm flex-grow">{props.file.path}</span>

                <div class="file-stats flex gap-2 text-xs font-mono ml-4">
                    <span class="text-green px-1 bg-green-subtle rounded">+{props.file.additions}</span>
                    <span class="text-red px-1 bg-red-subtle rounded">-{props.file.deletions}</span>
                </div>
            </div>

            <Show when={expanded()}>
                <div class="file-diff-body p-2 bg-primary overflow-x-auto border-t border-border rounded-b-md">
                    <Show when={!props.file.is_binary} fallback={<p class="text-muted text-sm">Binary file changed.</p>}>
                        <Show
                            when={!monacoFailed()}
                            fallback={<pre class="text-xs font-mono whitespace-pre-wrap text-primary">{fallbackText()}</pre>}
                        >
                            <MonacoDiffEditor
                                original={props.file.old_content || ""}
                                modified={props.file.new_content || ""}
                                language={detectLanguageForPath(props.file.path)}
                                inline={props.inline}
                                theme={props.theme}
                                onLoadError={() => setMonacoFailed(true)}
                            />
                        </Show>
                    </Show>
                </div>
            </Show>
        </div>
    );
}
