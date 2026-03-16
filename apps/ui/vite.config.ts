import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';
import { existsSync, readFileSync } from 'fs';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import monacoEditorPluginModule from 'vite-plugin-monaco-editor';

const monacoEditorPlugin =
    (monacoEditorPluginModule as unknown as {
        default?: typeof monacoEditorPluginModule;
    }).default ?? monacoEditorPluginModule;

const apiTarget = process.env.JJHUB_API_BASE_URL ?? 'https://jjhub.tech';
const sentryBuildPluginEnvPath = new URL('./.env.sentry-build-plugin', import.meta.url);
const sentryBuildConfigured =
    existsSync(sentryBuildPluginEnvPath) ||
    (Boolean(process.env.SENTRY_ORG) && Boolean(process.env.SENTRY_PROJECT));
const sentryProject = process.env.SENTRY_PROJECT
    ?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig(({ mode }) => {
    const isTest = mode === 'test' || process.env.VITEST === 'true';

    return {
        plugins: [
            solidPlugin(),
            tailwindcss(),
            !isTest
                ? monacoEditorPlugin({
                    languageWorkers: ['editorWorkerService', 'css', 'html', 'json'],
                    publicPath: 'monacoeditorwork',
                })
                : null,
            VitePWA({
                registerType: 'autoUpdate',
                includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'mask-icon.svg'],
                workbox: {
                    maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
                },
                manifest: {
                    name: 'JJHub Workspace',
                    short_name: 'JJHub',
                    description: 'JJHub Workspace Application',
                    theme_color: '#ffffff',
                    icons: [
                        {
                            src: 'pwa-192x192.png',
                            sizes: '192x192',
                            type: 'image/png'
                        },
                        {
                            src: 'pwa-512x512.png',
                            sizes: '512x512',
                            type: 'image/png'
                        }
                    ]
                }
            }),
            sentryVitePlugin({
                disable: !sentryBuildConfigured,
                telemetry: false,
                org: process.env.SENTRY_ORG,
                project: sentryProject && sentryProject.length > 1 ? sentryProject : sentryProject?.[0],
                authToken: process.env.SENTRY_AUTH_TOKEN,
                release: process.env.SENTRY_RELEASE
                    ? { name: process.env.SENTRY_RELEASE }
                    : undefined,
                applicationKey: 'jjhub-ui',
                sourcemaps: {
                    filesToDeleteAfterUpload: ['./dist/**/*.map'],
                },
            }),
        ].filter(Boolean),
        server: {
            proxy: {
                '/api': {
                    target: apiTarget,
                    changeOrigin: true,
                },
            },
        },
        preview: {
            proxy: {
                '/api': {
                    target: apiTarget,
                    changeOrigin: true,
                },
            },
        },
        define: {
            __APP_VERSION__: JSON.stringify(pkg.version),
            __SENTRY_APPLICATION_KEY_ENABLED__: JSON.stringify(sentryBuildConfigured),
            // Inject PUBLIC_REPO_OWNER so client code can read import.meta.env.PUBLIC_REPO_OWNER
            'import.meta.env.PUBLIC_REPO_OWNER': JSON.stringify(process.env.PUBLIC_REPO_OWNER || ''),
        },
        build: {
            target: 'esnext',
            sourcemap: sentryBuildConfigured ? 'hidden' : false,
        },
    };
});
