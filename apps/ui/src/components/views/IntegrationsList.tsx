import { createSignal, createResource, For, Show, createMemo } from 'solid-js';
import { Search, Plus, ShieldCheck, Cpu, Github, CheckSquare, Database, FileText } from 'lucide-solid';
import { apiFetch } from '../../lib/repoContext';

interface IntegrationCard {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    status: string;
    installed: boolean;
    kind: string;
    route?: string;
    capabilities: string[];
}

export default function IntegrationsList() {
    const [activeTab, setActiveTab] = createSignal<'mcp' | 'skills'>('mcp');
    const [query, setQuery] = createSignal('');

    const fetchMcpIntegrations = async (): Promise<IntegrationCard[]> => {
        const res = await apiFetch('/api/integrations/mcp');
        if (!res.ok) throw new Error('Failed to fetch MCP integrations');
        return res.json();
    };

    const fetchSkillsIntegrations = async () => {
        const res = await apiFetch('/api/integrations/skills');
        if (!res.ok) throw new Error('Failed to fetch Skills integrations');
        return res.json();
    };

    const [mcpIntegrations] = createResource(fetchMcpIntegrations);
    const [skillsIntegrations] = createResource(fetchSkillsIntegrations);

    const getIconComponent = (iconName: string) => {
        switch (iconName) {
            case 'github': return Github;
            case 'check-square': return CheckSquare;
            case 'database': return Database;
            case 'file-text': return FileText;
            default: return Cpu;
        }
    };

    const filteredMcpIntegrations = createMemo(() => {
        const term = query().trim().toLowerCase();
        const items = mcpIntegrations() ?? [];
        if (!term) return items;
        return items.filter((integration) =>
            `${integration.name} ${integration.description} ${integration.kind} ${(integration.capabilities ?? []).join(' ')}`
                .toLowerCase()
                .includes(term),
        );
    });

    const filteredSkills = createMemo(() => {
        const term = query().trim().toLowerCase();
        const items = skillsIntegrations() ?? [];
        if (!term) return items;
        return items.filter((skill: any) =>
            `${skill.name} ${skill.description} ${skill.author}`.toLowerCase().includes(term),
        );
    });

    const actionLabel = (integration: IntegrationCard) => integration.route ? integration.status : (integration.installed ? 'Available' : integration.status);

    return (
        <div class="flex flex-col h-full w-full bg-app text-primary">
            <div class="p-6 border-b border-color flex flex-col gap-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="text-xl font-semibold mb-1">Integrations & Skills</h1>
                        <p class="text-sm text-muted">Extend your workspace with Model Context Protocol servers and Agent Skills.</p>
                    </div>
                    <button class="btn btn-primary flex items-center gap-2">
                        <Plus size={16} />
                        Add Custom
                    </button>
                </div>

                <div class="flex items-center gap-6 border-b border-light">
                    <button
                        class={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab() === 'mcp' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-primary'}`}
                        onClick={() => setActiveTab('mcp')}
                    >
                        <div class="flex items-center gap-2">
                            <Cpu size={16} />
                            MCP Integrations
                        </div>
                    </button>
                    <button
                        class={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab() === 'skills' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-primary'}`}
                        onClick={() => setActiveTab('skills')}
                    >
                        <div class="flex items-center gap-2">
                            <ShieldCheck size={16} />
                            Agent Skills
                        </div>
                    </button>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto p-6">
                <div class="flex justify-between items-center mb-8">
                    <div class="relative w-full max-w-md flex items-center">
                        <Search class="absolute left-4 text-muted pointer-events-none" size={16} />
                        <input
                            type="text"
                            placeholder={`Search ${activeTab() === 'mcp' ? 'integrations' : 'skills'}...`}
                            value={query()}
                            onInput={(event) => setQuery(event.currentTarget.value)}
                            class="w-full pl-11 pr-4 py-2.5 bg-panel border border-color rounded-lg text-sm focus:border-blue transition-colors focus:outline-none"
                        />
                    </div>
                </div>

                {activeTab() === 'mcp' ? (
                    <Show when={!mcpIntegrations.loading} fallback={<div class="flex justify-center p-12"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <For each={filteredMcpIntegrations()}>
                                {(integration) => {
                                    const Icon = getIconComponent(integration.icon);
                                    return (
                                        <div class="bg-panel border border-color rounded-xl p-6 flex flex-col hover:border-light transition-colors group h-full">
                                            <div class="flex items-start justify-between mb-5">
                                                <div class="w-12 h-12 rounded-lg bg-root flex items-center justify-center border border-color">
                                                    <Icon size={24} class={integration.color} />
                                                </div>
                                                <span class={`text-xs px-2.5 py-1 rounded-md border ${integration.installed ? 'bg-green/10 text-green border-green/20' : 'bg-root text-muted border-color'}`}>
                                                    {integration.installed ? 'Installed' : 'Catalog'}
                                                </span>
                                            </div>
                                            <div class="flex-1">
                                                <div class="flex items-center gap-2 mb-2">
                                                    <h3 class="font-semibold text-lg group-hover:text-blue transition-colors">{integration.name}</h3>
                                                    <span class="text-[11px] uppercase tracking-wide text-muted">{integration.kind.replace('-', ' ')}</span>
                                                </div>
                                                <p class="text-sm text-muted leading-relaxed mb-4">{integration.description}</p>
                                                <div class="flex flex-wrap gap-2">
                                                    <For each={integration.capabilities}>
                                                        {(capability) => (
                                                            <span class="text-xs px-2 py-1 rounded-md bg-root border border-color text-muted">{capability}</span>
                                                        )}
                                                    </For>
                                                </div>
                                            </div>
                                            <div class="mt-6 pt-5 border-t border-color">
                                                <Show
                                                    when={integration.route}
                                                    fallback={<button class={`btn btn-sm ${integration.installed ? 'btn' : 'btn-primary'} w-full`} disabled>{actionLabel(integration)}</button>}
                                                >
                                                    <a href={integration.route!} class={`btn btn-sm ${integration.installed ? 'btn' : 'btn-primary'} w-full`}>
                                                        {actionLabel(integration)}
                                                    </a>
                                                </Show>
                                            </div>
                                        </div>
                                    );
                                }}
                            </For>
                        </div>
                    </Show>
                ) : (
                    <Show when={!skillsIntegrations.loading} fallback={<div class="flex justify-center p-12"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <For each={filteredSkills()}>
                                {(skill: any) => (
                                    <div class="bg-panel border border-color rounded-xl p-6 flex flex-col hover:border-light transition-colors cursor-pointer h-full">
                                        <div class="flex items-start justify-between mb-4">
                                            <h3 class="font-semibold text-lg">{skill.name}</h3>
                                            <ShieldCheck class="text-purple" size={20} />
                                        </div>
                                        <p class="text-sm text-muted leading-relaxed flex-1 mb-6">{skill.description}</p>
                                        <div class="flex items-center justify-between text-xs text-muted pt-4 border-t border-color mt-auto">
                                            <span>By {skill.author}</span>
                                            <div class="flex items-center gap-3">
                                                <span class="flex items-center gap-1">★ {skill.rating}</span>
                                                <span>↓ {skill.downloads}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>
                    </Show>
                )}
            </div>
        </div>
    );
}
