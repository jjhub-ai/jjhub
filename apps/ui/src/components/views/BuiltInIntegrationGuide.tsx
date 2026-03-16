import { For, Show } from 'solid-js';
import { ArrowLeft, Github, FileText, type LucideIcon } from 'lucide-solid';

export type BuiltInIntegrationGuideField = {
    name: string;
    description: string;
    required?: boolean;
};

export type BuiltInIntegrationGuideProps = {
    title: string;
    description: string;
    icon: 'github' | 'notion';
    capabilities: string[];
    statusNote?: string;
    envVars: BuiltInIntegrationGuideField[];
    webhookEvents?: string[];
    mappingExample: string;
    configExample?: string;
    notes: string[];
};

const icons: Record<BuiltInIntegrationGuideProps['icon'], LucideIcon> = {
    github: Github,
    notion: FileText,
};

export default function BuiltInIntegrationGuide(props: BuiltInIntegrationGuideProps) {
    const Icon = icons[props.icon];

    return (
        <div class="flex flex-col h-full w-full bg-app text-primary">
            <div class="p-6 border-b border-color">
                <a href="/integrations" class="inline-flex items-center gap-2 text-sm text-muted hover:text-primary transition-colors mb-4">
                    <ArrowLeft size={16} />
                    Back to integrations
                </a>
                <div class="flex items-start justify-between gap-6">
                    <div class="flex items-start gap-4">
                        <div class="w-12 h-12 rounded-lg bg-panel border border-color flex items-center justify-center">
                            <Icon size={24} />
                        </div>
                        <div>
                            <h1 class="text-xl font-semibold mb-1">{props.title}</h1>
                            <p class="text-sm text-muted max-w-3xl">{props.description}</p>
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-2 justify-end">
                        <For each={props.capabilities}>
                            {(capability) => (
                                <span class="text-xs px-2 py-1 rounded-md bg-panel border border-color text-muted">{capability}</span>
                            )}
                        </For>
                    </div>
                </div>
                <Show when={props.statusNote}>
                    <div class="mt-4 rounded-lg border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-amber">
                        {props.statusNote}
                    </div>
                </Show>
            </div>

            <div class="flex-1 overflow-y-auto p-6">
                <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-6">
                    <section class="bg-panel border border-color rounded-xl p-6">
                        <h2 class="text-lg font-semibold mb-4">Required Environment</h2>
                        <div class="space-y-3">
                            <For each={props.envVars}>
                                {(field) => (
                                    <div class="rounded-lg border border-color bg-root px-4 py-3">
                                        <div class="flex items-center gap-2 mb-1">
                                            <code class="text-sm font-semibold">{field.name}</code>
                                            <Show when={field.required}>
                                                <span class="text-[11px] uppercase tracking-wide text-red">Required</span>
                                            </Show>
                                        </div>
                                        <p class="text-sm text-muted">{field.description}</p>
                                    </div>
                                )}
                            </For>
                        </div>

                        <Show when={props.configExample}>
                            <div class="mt-6">
                                <h3 class="text-sm font-semibold uppercase tracking-wide text-muted mb-3">Example Service Config</h3>
                                <pre class="rounded-lg border border-color bg-root p-4 text-xs overflow-x-auto whitespace-pre-wrap">{props.configExample}</pre>
                            </div>
                        </Show>
                    </section>

                    <section class="space-y-6">
                        <div class="bg-panel border border-color rounded-xl p-6">
                            <h2 class="text-lg font-semibold mb-4">Mappings</h2>
                            <p class="text-sm text-muted mb-4">Set `JJHUB_SYNC_MAPPINGS` to a JSON array. Each mapping binds one external source to one JJHub repository.</p>
                            <pre class="rounded-lg border border-color bg-root p-4 text-xs overflow-x-auto whitespace-pre-wrap">{props.mappingExample}</pre>
                        </div>

                        <Show when={props.webhookEvents?.length}>
                            <div class="bg-panel border border-color rounded-xl p-6">
                                <h2 class="text-lg font-semibold mb-4">Webhook Coverage</h2>
                                <div class="flex flex-wrap gap-2">
                                    <For each={props.webhookEvents}>
                                        {(eventName) => (
                                            <span class="text-xs px-2 py-1 rounded-md bg-root border border-color text-muted">{eventName}</span>
                                        )}
                                    </For>
                                </div>
                            </div>
                        </Show>

                        <div class="bg-panel border border-color rounded-xl p-6">
                            <h2 class="text-lg font-semibold mb-4">Notes</h2>
                            <div class="space-y-3">
                                <For each={props.notes}>
                                    {(note) => <p class="text-sm text-muted">{note}</p>}
                                </For>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
