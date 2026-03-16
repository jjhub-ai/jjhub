import { For, Show, createSignal, onCleanup } from "solid-js";
import "./DiffFileTree.css";

export interface DiffTreeFile {
    id: string;
    path: string;
    changeType: string;
    additions: number;
    deletions: number;
    collapsed: boolean;
    generated: boolean;
}

interface DiffFileTreeProps {
    files: DiffTreeFile[];
    activeFileId: string | null;
    width: number;
    onWidthChange: (width: number) => void;
    onFileSelect: (fileId: string) => void;
}

const MIN_WIDTH = 220;
const MAX_WIDTH = 420;

function statusLabel(changeType: string): string {
    switch (changeType) {
        case "added":
            return "A";
        case "deleted":
            return "D";
        case "renamed":
            return "R";
        default:
            return "M";
    }
}

export default function DiffFileTree(props: DiffFileTreeProps) {
    const [isResizing, setIsResizing] = createSignal(false);

    const stopResize = () => setIsResizing(false);

    const onPointerMove = (event: PointerEvent) => {
        if (!isResizing()) {
            return;
        }

        props.onWidthChange(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, event.clientX)));
    };

    const onPointerUp = () => stopResize();

    if (typeof window !== "undefined") {
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
    }

    onCleanup(() => {
        if (typeof window !== "undefined") {
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
        }
    });

    return (
        <aside class="diff-file-tree" style={{ width: `${props.width}px` }}>
            <div class="diff-file-tree-header">
                <span>Files changed</span>
                <span class="diff-file-tree-count">{props.files.length}</span>
            </div>

            <Show when={props.files.length > 0} fallback={<p class="diff-file-tree-empty">No files changed.</p>}>
                <div class="diff-file-tree-list" role="tree">
                    <For each={props.files}>
                        {(file) => (
                            <button
                                class={`diff-file-tree-item ${props.activeFileId === file.id ? "is-active" : ""}`}
                                type="button"
                                onClick={() => props.onFileSelect(file.id)}
                                role="treeitem"
                            >
                                <span class={`diff-file-tree-status is-${file.changeType}`}>{statusLabel(file.changeType)}</span>
                                <span class="diff-file-tree-path">{file.path}</span>
                                <span class="diff-file-tree-stats">
                                    <span class="is-add">+{file.additions}</span>
                                    <span class="is-del">-{file.deletions}</span>
                                </span>
                                <Show when={file.generated}>
                                    <span class="diff-file-tree-chip">generated</span>
                                </Show>
                                <Show when={file.collapsed}>
                                    <span class="diff-file-tree-chip">collapsed</span>
                                </Show>
                            </button>
                        )}
                    </For>
                </div>
            </Show>

            <button
                class={`diff-file-tree-resize-handle ${isResizing() ? "is-active" : ""}`}
                type="button"
                aria-label="Resize file tree"
                onPointerDown={() => setIsResizing(true)}
            />
        </aside>
    );
}
