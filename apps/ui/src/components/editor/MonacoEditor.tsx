import { createEffect, onCleanup, onMount } from 'solid-js';
import type * as Monaco from 'monaco-editor';
import type { EditorThemePreference } from '../../stores/workbench';
import { loadMonaco, resolveMonacoTheme } from '../../lib/monacoLoader';

export interface MonacoEditorProps {
    content: string;
    language: string;
    readOnly?: boolean;
    theme?: EditorThemePreference;
    path?: string;
    fontSize?: number;
    onChange?: (value: string) => void;
    onSave?: () => void;
    onLoadError?: (error: Error) => void;
}

function normalizeModelPath(path: string | undefined): string {
    const cleaned = (path ?? 'untitled.txt').replace(/^\/+/, '');
    return cleaned.split('/').map(encodeURIComponent).join('/');
}

function isLargeFile(content: string): boolean {
    return content.split('\n').length > 10000;
}

export default function MonacoEditor(props: MonacoEditorProps) {
    let containerRef: HTMLDivElement | undefined;
    let monaco: MonacoModule | undefined;
    let editor: Monaco.editor.IStandaloneCodeEditor | undefined;
    let model: Monaco.editor.ITextModel | undefined;
    let isApplyingExternalContent = false;
    const disposables: Monaco.IDisposable[] = [];

    const applyEditorProps = () => {
        if (!monaco || !model || !editor) {
            return;
        }

        monaco.editor.setTheme(resolveMonacoTheme(props.theme));
        monaco.editor.setModelLanguage(model, props.language || 'plaintext');

        const nextContent = props.content ?? '';
        if (model.getValue() !== nextContent) {
            isApplyingExternalContent = true;
            model.setValue(nextContent);
            isApplyingExternalContent = false;
        }

        editor.updateOptions({
            readOnly: props.readOnly ?? true,
            fontSize: props.fontSize ?? 13,
            folding: !isLargeFile(nextContent),
            minimap: { enabled: !isLargeFile(nextContent) },
            bracketPairColorization: { enabled: !isLargeFile(nextContent) },
        });
    };

    onMount(async () => {
        try {
            monaco = await loadMonaco();
            if (!containerRef) {
                return;
            }

            model = monaco.editor.createModel(
                props.content ?? '',
                props.language || 'plaintext',
                monaco.Uri.parse(`file:///${normalizeModelPath(props.path)}`),
            );

            monaco.editor.setTheme(resolveMonacoTheme(props.theme));

            editor = monaco.editor.create(containerRef, {
                model,
                automaticLayout: true,
                readOnly: props.readOnly ?? true,
                fontFamily: 'var(--font-mono)',
                fontSize: props.fontSize ?? 13,
                glyphMargin: true,
                lineNumbers: 'on',
                folding: !isLargeFile(props.content ?? ''),
                largeFileOptimizations: true,
                minimap: { enabled: !isLargeFile(props.content ?? '') },
                guides: { indentation: true },
                bracketPairColorization: { enabled: !isLargeFile(props.content ?? '') },
                scrollBeyondLastLine: false,
                wordWrap: 'off',
                renderWhitespace: 'selection',
                smoothScrolling: true,
            });

            disposables.push(editor.onDidChangeModelContent(() => {
                if (isApplyingExternalContent || !model) {
                    return;
                }
                props.onChange?.(model.getValue());
            }));

            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                props.onSave?.();
            });

            applyEditorProps();
        } catch (error) {
            props.onLoadError?.(error instanceof Error ? error : new Error('Failed to load Monaco editor'));
        }
    });

    createEffect(() => {
        applyEditorProps();
    });

    onCleanup(() => {
        while (disposables.length > 0) {
            disposables.pop()?.dispose();
        }
        editor?.dispose();
        model?.dispose();
    });

    return <div ref={containerRef} class="monaco-container" />;
}

type MonacoModule = typeof import('monaco-editor');
