import { createMemo, createSignal, For, Show } from 'solid-js';
import MarkdownIt from 'markdown-it';
import type { EditorThemePreference } from '../../stores/workbench';
import MonacoEditor from './MonacoEditor';

export type FilePreviewKind = 'code' | 'markdown' | 'image' | 'pdf' | 'binary';

export interface FilePreviewProps {
    path: string;
    content: string;
    language: string;
    monacoEnabled: boolean;
    readOnly?: boolean;
    theme?: EditorThemePreference;
    fontSize?: number;
    onChange?: (value: string) => void;
    onSave?: () => void;
}

const markdown = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: false,
});

const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.svg']);
const markdownExtensions = new Set(['.md', '.markdown', '.mdx']);
const pdfExtensions = new Set(['.pdf']);
const explicitBinaryExtensions = new Set(['.zip', '.gz', '.tgz', '.tar', '.jar', '.exe', '.dll', '.so', '.wasm', '.woff', '.woff2', '.ttf', '.otf']);

function fileExtension(path: string): string {
    const lastDot = path.lastIndexOf('.');
    return lastDot >= 0 ? path.slice(lastDot).toLowerCase() : '';
}

function looksLikeBase64(content: string): boolean {
    const normalized = content.replace(/\s+/g, '');
    return normalized.length > 0 && normalized.length % 4 === 0 && /^[A-Za-z0-9+/]+=*$/.test(normalized);
}

function isProbablyBinaryContent(content: string): boolean {
    if (!content) {
        return false;
    }
    if (content.includes('\u0000')) {
        return true;
    }

    let suspiciousChars = 0;
    for (const char of content) {
        const code = char.charCodeAt(0);
        if (code === 9 || code === 10 || code === 13) {
            continue;
        }
        if (code < 32 || code === 65533) {
            suspiciousChars += 1;
        }
    }

    return suspiciousChars / content.length > 0.2;
}

function imageMimeType(path: string): string {
    switch (fileExtension(path)) {
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.gif':
            return 'image/gif';
        case '.webp':
            return 'image/webp';
        case '.bmp':
            return 'image/bmp';
        case '.ico':
            return 'image/x-icon';
        case '.svg':
            return 'image/svg+xml';
        default:
            return 'image/png';
    }
}

function buildImageSource(path: string, content: string): string | null {
    if (fileExtension(path) === '.svg') {
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(content)}`;
    }

    if (looksLikeBase64(content)) {
        return `data:${imageMimeType(path)};base64,${content.replace(/\s+/g, '')}`;
    }

    return null;
}

function buildPdfSource(content: string): string | null {
    if (!looksLikeBase64(content)) {
        return null;
    }
    return `data:application/pdf;base64,${content.replace(/\s+/g, '')}`;
}

export function detectLanguageForPath(path: string): string {
    const lowerPath = path.toLowerCase();
    const extension = fileExtension(lowerPath);

    if (lowerPath.endsWith('/dockerfile') || lowerPath === 'dockerfile') return 'dockerfile';
    if (lowerPath.endsWith('/containerfile') || lowerPath === 'containerfile') return 'dockerfile';
    if (lowerPath.endsWith('.d.ts') || extension === '.ts' || extension === '.tsx') return 'typescript';
    if (extension === '.js' || extension === '.jsx' || extension === '.mjs' || extension === '.cjs') return 'javascript';
    if (extension === '.go') return 'go';
    if (extension === '.rs') return 'rust';
    if (extension === '.py') return 'python';
    if (extension === '.json') return 'json';
    if (extension === '.yaml' || extension === '.yml') return 'yaml';
    if (extension === '.html' || extension === '.htm') return 'html';
    if (extension === '.css' || extension === '.scss' || extension === '.less') return 'css';
    if (extension === '.md' || extension === '.markdown' || extension === '.mdx') return 'markdown';
    if (extension === '.sql') return 'sql';
    if (extension === '.sh' || extension === '.bash' || extension === '.zsh') return 'shell';
    if (extension === '.toml') return 'ini';
    return 'plaintext';
}

export function detectPreviewKind(path: string, content = ''): FilePreviewKind {
    const extension = fileExtension(path);
    if (markdownExtensions.has(extension)) return 'markdown';
    if (imageExtensions.has(extension)) return 'image';
    if (pdfExtensions.has(extension)) return 'pdf';
    if (explicitBinaryExtensions.has(extension) || isProbablyBinaryContent(content)) return 'binary';
    return 'code';
}

function PlainTextViewer(props: { content: string }) {
    const lines = createMemo(() => props.content.split('\n'));

    return (
        <div class="plain-code-view">
            <div class="line-numbers">
                <For each={lines()}>
                    {(_, index) => <div class="line-number">{index() + 1}</div>}
                </For>
            </div>
            <div class="code-lines">
                <For each={lines()}>
                    {(line) => <div class="code-line">{line || ' '}</div>}
                </For>
            </div>
        </div>
    );
}

export default function FilePreview(props: FilePreviewProps) {
    const [monacoFailed, setMonacoFailed] = createSignal(false);
    const previewKind = createMemo(() => detectPreviewKind(props.path, props.content));
    const imageSource = createMemo(() => buildImageSource(props.path, props.content));
    const pdfSource = createMemo(() => buildPdfSource(props.content));
    const markdownHtml = createMemo(() => markdown.render(props.content ?? ''));

    const shouldUseMonaco = createMemo(() => props.monacoEnabled && !monacoFailed());

    return (
        <div class="file-preview">
            <Show when={previewKind() === 'image'}>
                <Show
                    when={imageSource()}
                    fallback={<div class="file-preview-placeholder">Image preview is unavailable for this file encoding.</div>}
                >
                    {(src) => <img src={src()} alt={props.path} class="image-preview" />}
                </Show>
            </Show>

            <Show when={previewKind() === 'pdf'}>
                <Show
                    when={pdfSource()}
                    fallback={<div class="file-preview-placeholder">PDF preview requires a binary-safe download endpoint.</div>}
                >
                    {(src) => <iframe src={src()} title={props.path} class="pdf-preview" />}
                </Show>
            </Show>

            <Show when={previewKind() === 'binary'}>
                <div class="file-preview-placeholder">Binary file preview is not available in the web editor yet.</div>
            </Show>

            <Show when={previewKind() === 'code'}>
                <Show
                    when={shouldUseMonaco()}
                    fallback={<PlainTextViewer content={props.content} />}
                >
                    <MonacoEditor
                        path={props.path}
                        content={props.content}
                        language={props.language}
                        readOnly={props.readOnly}
                        theme={props.theme}
                        fontSize={props.fontSize}
                        onChange={props.onChange}
                        onSave={props.onSave}
                        onLoadError={() => setMonacoFailed(true)}
                    />
                </Show>
            </Show>

            <Show when={previewKind() === 'markdown'}>
                <div class="markdown-preview-shell">
                    <div class="markdown-editor-pane">
                        <Show
                            when={shouldUseMonaco()}
                            fallback={<PlainTextViewer content={props.content} />}
                        >
                            <MonacoEditor
                                path={props.path}
                                content={props.content}
                                language={props.language}
                                readOnly={props.readOnly}
                                theme={props.theme}
                                fontSize={props.fontSize}
                                onChange={props.onChange}
                                onSave={props.onSave}
                                onLoadError={() => setMonacoFailed(true)}
                            />
                        </Show>
                    </div>
                    <div class="markdown-rendered-pane">
                        <div class="markdown-rendered-content" innerHTML={markdownHtml()} />
                    </div>
                </div>
            </Show>
        </div>
    );
}
