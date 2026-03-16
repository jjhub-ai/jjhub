import type * as Monaco from 'monaco-editor';
import type { EditorThemePreference } from '../stores/workbench';

type MonacoModule = typeof import('monaco-editor');
type MonacoEnvironmentShape = {
    globalAPI?: boolean;
    getWorkerUrl?: (moduleId: string, label: string) => string;
};

declare global {
    interface Window {
        MonacoEnvironment?: MonacoEnvironmentShape;
    }
}

const MONACO_PUBLIC_PATH = 'monacoeditorwork';
const workerFiles: Record<string, string> = {
    editorWorkerService: 'editor.worker.bundle.js',
    json: 'json.worker.bundle.js',
    css: 'css.worker.bundle.js',
    scss: 'css.worker.bundle.js',
    less: 'css.worker.bundle.js',
    html: 'html.worker.bundle.js',
    handlebars: 'html.worker.bundle.js',
    razor: 'html.worker.bundle.js',
    typescript: 'ts.worker.bundle.js',
    javascript: 'ts.worker.bundle.js',
};

let monacoPromise: Promise<MonacoModule> | null = null;

function resolveWorkerPath(label: string): string {
    const base = import.meta.env.BASE_URL || '/';
    const prefix = base.endsWith('/') ? base : `${base}/`;
    const filename = workerFiles[label] ?? workerFiles.editorWorkerService;
    return `${prefix}${MONACO_PUBLIC_PATH}/${filename}`;
}

function ensureMonacoEnvironment(): void {
    const current = (globalThis as typeof globalThis & { MonacoEnvironment?: MonacoEnvironmentShape }).MonacoEnvironment;
    if (current?.getWorkerUrl) {
        return;
    }
    const fallback: MonacoEnvironmentShape = {
        globalAPI: false,
        getWorkerUrl: (_moduleId, label) => resolveWorkerPath(label),
    };
    (globalThis as typeof globalThis & { MonacoEnvironment?: MonacoEnvironmentShape }).MonacoEnvironment = {
        ...current,
        ...fallback,
    };
}

function readCssColor(variableName: string, fallback: string): string {
    if (typeof window === 'undefined') {
        return fallback;
    }
    const value = window.getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
    return value || fallback;
}

function themeColors(theme: EditorThemePreference): Record<string, string> {
    if (theme === 'jjhub-light') {
        return {
            'editor.background': readCssColor('--monaco-bg-light', '#f7f8fb'),
            'editor.foreground': readCssColor('--monaco-fg-light', '#1f2937'),
            'editorLineNumber.foreground': readCssColor('--monaco-line-number-light', '#6b7280'),
            'editorLineNumber.activeForeground': readCssColor('--monaco-active-line-number-light', '#111827'),
            'editorCursor.foreground': readCssColor('--accent-blue', '#4467d8'),
            'editor.selectionBackground': readCssColor('--monaco-selection-light', '#dbe6ff'),
            'editor.inactiveSelectionBackground': readCssColor('--monaco-selection-light-muted', '#eef2ff'),
            'editorIndentGuide.background1': readCssColor('--monaco-guide-light', '#d1d5db'),
            'editorIndentGuide.activeBackground1': readCssColor('--accent-blue', '#4467d8'),
        };
    }

    return {
        'editor.background': readCssColor('--monaco-bg', '#0b0e14'),
        'editor.foreground': readCssColor('--monaco-fg', '#f0f2f5'),
        'editorLineNumber.foreground': readCssColor('--monaco-line-number', '#6b7280'),
        'editorLineNumber.activeForeground': readCssColor('--monaco-active-line-number', '#f0f2f5'),
        'editorCursor.foreground': readCssColor('--accent-blue', '#7b93d9'),
        'editor.selectionBackground': readCssColor('--monaco-selection', '#24324f'),
        'editor.inactiveSelectionBackground': readCssColor('--monaco-selection-muted', '#1a2335'),
        'editorIndentGuide.background1': readCssColor('--monaco-guide', '#273245'),
        'editorIndentGuide.activeBackground1': readCssColor('--accent-blue', '#7b93d9'),
    };
}

function registerTheme(monaco: MonacoModule, themeName: EditorThemePreference): void {
    const darkThemeRules: Monaco.editor.ITokenThemeRule[] = [
        { token: 'comment', foreground: '768399', fontStyle: 'italic' },
        { token: 'keyword', foreground: '7B93D9' },
        { token: 'string', foreground: '7FD38D' },
        { token: 'number', foreground: 'E3B341' },
        { token: 'type', foreground: '3BC9DB' },
    ];
    const lightThemeRules: Monaco.editor.ITokenThemeRule[] = [
        { token: 'comment', foreground: '6B7280', fontStyle: 'italic' },
        { token: 'keyword', foreground: '4467D8' },
        { token: 'string', foreground: '2F855A' },
        { token: 'number', foreground: 'B7791F' },
        { token: 'type', foreground: '0F766E' },
    ];

    monaco.editor.defineTheme(themeName, {
        base: themeName === 'jjhub-light' ? 'vs' : 'vs-dark',
        inherit: true,
        rules: themeName === 'jjhub-light' ? lightThemeRules : darkThemeRules,
        colors: themeColors(themeName),
    });
}

export function resolveMonacoTheme(theme: EditorThemePreference | undefined): EditorThemePreference {
    return theme === 'jjhub-light' ? 'jjhub-light' : 'jjhub-dark';
}

export async function loadMonaco(): Promise<MonacoModule> {
    if (monacoPromise) {
        return monacoPromise;
    }

    monacoPromise = Promise.all([
        import('monaco-editor/esm/vs/editor/editor.all.js'),
        import('monaco-editor/esm/vs/editor/editor.api'),
        import('monaco-editor/esm/vs/language/json/monaco.contribution'),
        import('monaco-editor/esm/vs/language/html/monaco.contribution'),
        import('monaco-editor/esm/vs/language/css/monaco.contribution'),
        import('monaco-editor/esm/vs/basic-languages/dockerfile/dockerfile.contribution'),
        import('monaco-editor/esm/vs/basic-languages/go/go.contribution'),
        import('monaco-editor/esm/vs/basic-languages/ini/ini.contribution'),
        import('monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution'),
        import('monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution'),
        import('monaco-editor/esm/vs/basic-languages/python/python.contribution'),
        import('monaco-editor/esm/vs/basic-languages/rust/rust.contribution'),
        import('monaco-editor/esm/vs/basic-languages/shell/shell.contribution'),
        import('monaco-editor/esm/vs/basic-languages/sql/sql.contribution'),
        import('monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution'),
        import('monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution'),
    ])
        .then(([, monaco]) => {
            ensureMonacoEnvironment();
            const monacoModule = monaco as unknown as MonacoModule;
            registerTheme(monacoModule, 'jjhub-dark');
            registerTheme(monacoModule, 'jjhub-light');
            return monacoModule;
        })
        .catch((error: unknown) => {
            monacoPromise = null;
            throw error instanceof Error ? error : new Error('Failed to load Monaco editor');
        });

    return monacoPromise;
}
