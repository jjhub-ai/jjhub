import { createEffect, onCleanup, onMount } from 'solid-js';
import type * as Monaco from 'monaco-editor';
import type { EditorThemePreference } from '../../stores/workbench';
import { loadMonaco, resolveMonacoTheme } from '../../lib/monacoLoader';

export interface MonacoDiffEditorProps {
    original: string;
    modified: string;
    language: string;
    theme?: EditorThemePreference;
    inline?: boolean;
    onLoadError?: (error: Error) => void;
}

export default function MonacoDiffEditor(props: MonacoDiffEditorProps) {
    let containerRef: HTMLDivElement | undefined;
    let monaco: MonacoModule | undefined;
    let diffEditor: Monaco.editor.IStandaloneDiffEditor | undefined;
    let originalModel: Monaco.editor.ITextModel | undefined;
    let modifiedModel: Monaco.editor.ITextModel | undefined;

    const applyDiffProps = () => {
        if (!monaco || !diffEditor || !originalModel || !modifiedModel) {
            return;
        }

        monaco.editor.setTheme(resolveMonacoTheme(props.theme));
        monaco.editor.setModelLanguage(originalModel, props.language || 'plaintext');
        monaco.editor.setModelLanguage(modifiedModel, props.language || 'plaintext');

        if (originalModel.getValue() !== props.original) {
            originalModel.setValue(props.original);
        }
        if (modifiedModel.getValue() !== props.modified) {
            modifiedModel.setValue(props.modified);
        }

        diffEditor.updateOptions({
            renderSideBySide: !props.inline,
        });
    };

    onMount(async () => {
        try {
            monaco = await loadMonaco();
            if (!containerRef) {
                return;
            }

            originalModel = monaco.editor.createModel(props.original, props.language || 'plaintext');
            modifiedModel = monaco.editor.createModel(props.modified, props.language || 'plaintext');

            monaco.editor.setTheme(resolveMonacoTheme(props.theme));

            diffEditor = monaco.editor.createDiffEditor(containerRef, {
                automaticLayout: true,
                readOnly: true,
                renderSideBySide: !props.inline,
                lineNumbers: 'on',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                renderOverviewRuler: true,
            });

            diffEditor.setModel({
                original: originalModel,
                modified: modifiedModel,
            });

            applyDiffProps();
        } catch (error) {
            props.onLoadError?.(error instanceof Error ? error : new Error('Failed to load Monaco diff editor'));
        }
    });

    createEffect(() => {
        applyDiffProps();
    });

    onCleanup(() => {
        diffEditor?.dispose();
        originalModel?.dispose();
        modifiedModel?.dispose();
    });

    return <div ref={containerRef} class="monaco-container monaco-diff-container" />;
}

type MonacoModule = typeof import('monaco-editor');
