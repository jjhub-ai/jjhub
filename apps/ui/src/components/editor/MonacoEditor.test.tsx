// @vitest-environment jsdom

import { render, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

const monacoState = vi.hoisted(() => {
    let value = "";
    let changeHandler: (() => void) | undefined;
    let saveHandler: (() => void) | undefined;

    const model = {
        getValue: vi.fn(() => value),
        setValue: vi.fn((next: string) => {
            value = next;
        }),
        dispose: vi.fn(),
    };

    const editor = {
        onDidChangeModelContent: vi.fn((handler: () => void) => {
            changeHandler = handler;
            return { dispose: vi.fn() };
        }),
        addCommand: vi.fn((_binding: number, handler: () => void) => {
            saveHandler = handler;
            return 1;
        }),
        updateOptions: vi.fn(),
        dispose: vi.fn(),
    };

    const monaco = {
        Uri: {
            parse: vi.fn((input: string) => ({ toString: () => input })),
        },
        editor: {
            createModel: vi.fn((initialValue: string) => {
                value = initialValue;
                return model;
            }),
            create: vi.fn(() => editor),
            setTheme: vi.fn(),
            setModelLanguage: vi.fn(),
        },
        KeyMod: {
            CtrlCmd: 2048,
        },
        KeyCode: {
            KeyS: 49,
        },
    };

    return {
        monaco,
        model,
        editor,
        reset() {
            value = "";
            changeHandler = undefined;
            saveHandler = undefined;
            model.getValue.mockClear();
            model.setValue.mockClear();
            model.dispose.mockClear();
            editor.onDidChangeModelContent.mockClear();
            editor.addCommand.mockClear();
            editor.updateOptions.mockClear();
            editor.dispose.mockClear();
            monaco.Uri.parse.mockClear();
            monaco.editor.createModel.mockClear();
            monaco.editor.create.mockClear();
            monaco.editor.setTheme.mockClear();
            monaco.editor.setModelLanguage.mockClear();
        },
        emitChange(nextValue: string) {
            value = nextValue;
            changeHandler?.();
        },
        triggerSave() {
            saveHandler?.();
        },
    };
});

vi.mock("../../lib/monacoLoader", () => ({
    loadMonaco: vi.fn(async () => monacoState.monaco),
    resolveMonacoTheme: vi.fn((theme: string | undefined) => theme ?? "jjhub-dark"),
}));

import MonacoEditor from "./MonacoEditor";

describe("MonacoEditor", () => {
    beforeEach(() => {
        monacoState.reset();
    });

    it("creates the Monaco model with the provided content and language", async () => {
        render(() => (
            <MonacoEditor
                path="src/app.ts"
                content={"console.log('hi');"}
                language="typescript"
                theme="jjhub-dark"
            />
        ));

        await waitFor(() => {
            expect(monacoState.monaco.editor.createModel).toHaveBeenCalledWith(
                "console.log('hi');",
                "typescript",
                expect.anything(),
            );
        });

        expect(monacoState.monaco.editor.setTheme).toHaveBeenCalledWith("jjhub-dark");
    });

    it("forwards editor changes through onChange", async () => {
        const onChange = vi.fn();

        render(() => (
            <MonacoEditor
                path="src/app.ts"
                content="const value = 1;"
                language="typescript"
                onChange={onChange}
            />
        ));

        await waitFor(() => {
            expect(monacoState.editor.onDidChangeModelContent).toHaveBeenCalled();
        });

        monacoState.emitChange("const value = 2;");

        expect(onChange).toHaveBeenCalledWith("const value = 2;");
    });

    it("wires Ctrl/Cmd+S to onSave", async () => {
        const onSave = vi.fn();

        render(() => (
            <MonacoEditor
                path="src/app.ts"
                content="const value = 1;"
                language="typescript"
                onSave={onSave}
            />
        ));

        await waitFor(() => {
            expect(monacoState.editor.addCommand).toHaveBeenCalled();
        });

        monacoState.triggerSave();

        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it("updates editor options and disposes editor resources on unmount", async () => {
        const rendered = render(() => (
            <MonacoEditor
                path="README.md"
                content=""
                language="markdown"
                readOnly
                fontSize={15}
            />
        ));

        await waitFor(() => {
            expect(monacoState.editor.updateOptions).toHaveBeenCalledWith(
                expect.objectContaining({
                    readOnly: true,
                    fontSize: 15,
                }),
            );
        });

        rendered.unmount();

        expect(monacoState.editor.dispose).toHaveBeenCalledTimes(1);
        expect(monacoState.model.dispose).toHaveBeenCalledTimes(1);
    });
});
