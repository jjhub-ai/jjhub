import type { DiffViewMode, DiffWhitespaceMode } from "../../stores/diff-preferences";
import "./DiffToolbar.css";

interface DiffToolbarProps {
    viewMode: DiffViewMode;
    whitespaceMode: DiffWhitespaceMode;
    onViewModeChange: (mode: DiffViewMode) => void;
    onWhitespaceModeChange: (mode: DiffWhitespaceMode) => void;
    onExpandAll: () => void;
    onCollapseAll: () => void;
}

export default function DiffToolbar(props: DiffToolbarProps) {
    return (
        <div class="diff-toolbar">
            <div class="diff-toolbar-group" role="group" aria-label="Diff view mode">
                <button
                    class={`diff-toolbar-button ${props.viewMode === "unified" ? "is-active" : ""}`}
                    type="button"
                    onClick={() => props.onViewModeChange("unified")}
                >
                    Unified
                </button>
                <button
                    class={`diff-toolbar-button ${props.viewMode === "split" ? "is-active" : ""}`}
                    type="button"
                    onClick={() => props.onViewModeChange("split")}
                >
                    Split
                </button>
            </div>

            <div class="diff-toolbar-group" role="group" aria-label="Whitespace mode">
                <button
                    class={`diff-toolbar-button ${props.whitespaceMode === "show" ? "is-active" : ""}`}
                    type="button"
                    onClick={() => props.onWhitespaceModeChange("show")}
                >
                    Show whitespace
                </button>
                <button
                    class={`diff-toolbar-button ${props.whitespaceMode === "ignore" ? "is-active" : ""}`}
                    type="button"
                    onClick={() => props.onWhitespaceModeChange("ignore")}
                >
                    Hide whitespace
                </button>
            </div>

            <div class="diff-toolbar-spacer" />

            <div class="diff-toolbar-group">
                <button class="diff-toolbar-button" type="button" onClick={props.onExpandAll}>
                    Expand all
                </button>
                <button class="diff-toolbar-button" type="button" onClick={props.onCollapseAll}>
                    Collapse all
                </button>
            </div>

            <div class="diff-toolbar-shortcuts">
                <span>`v` view</span>
                <span>`j`/`k` files</span>
                <span>`n`/`p` hunks</span>
            </div>
        </div>
    );
}
