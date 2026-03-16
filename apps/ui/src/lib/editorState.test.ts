import { beforeEach, describe, expect, it } from "vitest";
import {
    $activeTab,
    $dirtyFiles,
    $editorSettings,
    $openTabs,
    closeEditorTab,
    reorderEditorTabs,
    resetEditorState,
    setActiveEditorTab,
    setDirtyFile,
    upsertEditorTab,
} from "./editorState";
import { $editorFontSize, $editorTheme, $editorVimMode } from "../stores/workbench";

describe("editorState", () => {
    beforeEach(() => {
        resetEditorState();
        $editorTheme.set("jjhub-dark");
        $editorFontSize.set(13);
        $editorVimMode.set(false);
    });

    it("adds, activates, closes, and reorders tabs", () => {
        upsertEditorTab({
            id: "README.md",
            path: "README.md",
            title: "README.md",
            language: "markdown",
            previewType: "markdown",
        });
        upsertEditorTab({
            id: "src/app.ts",
            path: "src/app.ts",
            title: "app.ts",
            language: "typescript",
            previewType: "code",
        });

        expect($openTabs.get().map((tab) => tab.id)).toEqual(["README.md", "src/app.ts"]);
        expect($activeTab.get()).toBe("src/app.ts");

        reorderEditorTabs(1, 0);
        expect($openTabs.get().map((tab) => tab.id)).toEqual(["src/app.ts", "README.md"]);

        setActiveEditorTab("README.md");
        closeEditorTab("README.md");

        expect($openTabs.get().map((tab) => tab.id)).toEqual(["src/app.ts"]);
        expect($activeTab.get()).toBe("src/app.ts");
    });

    it("tracks dirty files and exposes derived editor settings", () => {
        setDirtyFile("src/app.ts", true);
        setDirtyFile("README.md", true);
        setDirtyFile("README.md", false);

        expect($dirtyFiles.get()).toEqual({
            "src/app.ts": true,
        });

        $editorTheme.set("jjhub-light");
        $editorFontSize.set(15);
        $editorVimMode.set(true);

        expect($editorSettings.get()).toEqual({
            theme: "jjhub-light",
            fontSize: 15,
            vimMode: true,
            minimap: true,
        });
    });
});
