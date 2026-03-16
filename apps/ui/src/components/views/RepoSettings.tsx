import { createSignal, onMount, For, Show } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import { Settings, Tag, Target, Webhook, Plus, Trash2, Edit2, CheckCircle2, AlertTriangle, Send } from "lucide-solid";
import { withAuthHeaders } from "../../lib/repoContext";
import "./RepoSettings.css";

type RepoInfo = {
    name: string;
    description: string;
    is_public?: boolean;
    private?: boolean;
    default_bookmark: string;
    topics: string[];
};

type Label = {
    id: number;
    name: string;
    color: string;
    description: string;
};

type Milestone = {
    id: number;
    title: string;
    description: string;
    state: string;
    due_date?: string;
};

type WebhookData = {
    id: number;
    url: string;
    secret: string;
    events: string[];
    is_active: boolean;
};

export default function RepoSettings() {
    const navigate = useNavigate();
    const params = useParams<{ owner: string; repo: string }>();

    const ctx = () => ({ owner: params.owner ?? "", repo: params.repo ?? "" });
    const owner = params.owner || ctx().owner;
    const repo = params.repo || ctx().repo;

    const [activeTab, setActiveTab] = createSignal<"general" | "labels" | "milestones" | "webhooks">("general");
    const [isLoading, setIsLoading] = createSignal(true);
    const [isSaving, setIsSaving] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [successMessage, setSuccessMessage] = createSignal<string | null>(null);

    // Data lists
    const [repoInfo, setRepoInfo] = createSignal<RepoInfo | null>(null);
    const [labels, setLabels] = createSignal<Label[]>([]);
    const [milestones, setMilestones] = createSignal<Milestone[]>([]);
    const [webhooks, setWebhooks] = createSignal<WebhookData[]>([]);

    // Form inputs
    const [editDesc, setEditDesc] = createSignal("");
    const [editTopics, setEditTopics] = createSignal("");
    const [editIsPrivate, setEditIsPrivate] = createSignal(false);

    const [newLabelName, setNewLabelName] = createSignal("");
    const [newLabelColor, setNewLabelColor] = createSignal("#1b253b");
    const [newLabelDesc, setNewLabelDesc] = createSignal("");
    const [isCreatingLabel, setIsCreatingLabel] = createSignal(false);

    const [newMsTitle, setNewMsTitle] = createSignal("");
    const [newMsDesc, setNewMsDesc] = createSignal("");
    const [newMsDueDate, setNewMsDueDate] = createSignal("");
    const [isCreatingMs, setIsCreatingMs] = createSignal(false);

    const [newHookUrl, setNewHookUrl] = createSignal("");
    const [newHookSecret, setNewHookSecret] = createSignal("");
    const [newHookEvents, setNewHookEvents] = createSignal<string[]>(["push"]);
    const [isCreatingHook, setIsCreatingHook] = createSignal(false);

    const loadData = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const [repoRes, labelsRes, msRes, hooksRes] = await Promise.all([
                fetch(`/api/repos/${owner}/${repo}`, { headers: withAuthHeaders() }),
                fetch(`/api/repos/${owner}/${repo}/labels`, { headers: withAuthHeaders() }),
                fetch(`/api/repos/${owner}/${repo}/milestones`, { headers: withAuthHeaders() }),
                fetch(`/api/repos/${owner}/${repo}/hooks`, { headers: withAuthHeaders() }).catch(() => ({ ok: false, json: () => [] }))
            ]);

            if (repoRes.ok) {
                const info = await repoRes.json() as RepoInfo;
                setRepoInfo(info);
                setEditDesc(info.description || "");
                setEditTopics(info.topics?.join(", ") || "");
                setEditIsPrivate(info.private ?? !info.is_public);
            }
            if (labelsRes.ok) setLabels(await labelsRes.json());
            if (msRes.ok) setMilestones(await msRes.json());
            if ('ok' in hooksRes && hooksRes.ok) setWebhooks(await hooksRes.json());
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    onMount(() => void loadData());

    const updateGeneral = async (e: Event) => {
        e.preventDefault();
        setIsSaving(true);
        setErrorMessage(null);
        setSuccessMessage(null);
        try {
            const res = await fetch(`/api/repos/${owner}/${repo}`, {
                method: "PATCH",
                headers: withAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({
                    description: editDesc(),
                    private: editIsPrivate(),
                    topics: editTopics().split(",").map(t => t.trim()).filter(Boolean)
                })
            });
            if (!res.ok) throw new Error("Failed to update repository settings");
            setSuccessMessage("Repository settings updated successfully");
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    };

    const deleteRepo = async () => {
        if (!confirm(`Are you sure you want to delete ${owner}/${repo}? This action cannot be undone.`)) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/repos/${owner}/${repo}`, {
                method: "DELETE",
                headers: withAuthHeaders()
            });
            if (!res.ok) throw new Error("Failed to delete repository");
            navigate(`/?deleted=${encodeURIComponent(owner + "/" + repo)}`, { replace: true });
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
            setIsSaving(false);
        }
    };

    const createLabel = async (e: Event) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const res = await fetch(`/api/repos/${owner}/${repo}/labels`, {
                method: "POST",
                headers: withAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ name: newLabelName(), color: newLabelColor(), description: newLabelDesc() })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Failed to create label");
            }
            setIsCreatingLabel(false);
            setNewLabelName("");
            setNewLabelDesc("");
            void loadData();
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    };

    const deleteLabel = async (id: number) => {
        if (!confirm("Delete this label?")) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/repos/${owner}/${repo}/labels/${id}`, {
                method: "DELETE",
                headers: withAuthHeaders()
            });
            if (!res.ok) throw new Error("Failed to delete label");
            setLabels(labels().filter(l => l.id !== id));
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    };

    const createMilestone = async (e: Event) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const res = await fetch(`/api/repos/${owner}/${repo}/milestones`, {
                method: "POST",
                headers: withAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ title: newMsTitle(), description: newMsDesc(), due_date: newMsDueDate() ? new Date(newMsDueDate()).toISOString() : undefined })
            });
            if (!res.ok) throw new Error("Failed to create milestone");
            setIsCreatingMs(false);
            setNewMsTitle("");
            setNewMsDesc("");
            setNewMsDueDate("");
            void loadData();
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    };

    const deleteMilestone = async (id: number) => {
        if (!confirm("Delete this milestone?")) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/repos/${owner}/${repo}/milestones/${id}`, {
                method: "DELETE",
                headers: withAuthHeaders()
            });
            if (!res.ok) throw new Error("Failed to delete milestone");
            setMilestones(milestones().filter(m => m.id !== id));
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    };

    const createWebhook = async (e: Event) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const res = await fetch(`/api/repos/${owner}/${repo}/hooks`, {
                method: "POST",
                headers: withAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ url: newHookUrl(), secret: newHookSecret(), events: newHookEvents(), is_active: true })
            });
            if (!res.ok) throw new Error("Failed to create webhook");
            setIsCreatingHook(false);
            setNewHookUrl("");
            setNewHookSecret("");
            void loadData();
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    };

    const deleteWebhook = async (id: number) => {
        if (!confirm("Delete this webhook?")) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/repos/${owner}/${repo}/hooks/${id}`, {
                method: "DELETE",
                headers: withAuthHeaders()
            });
            if (!res.ok) throw new Error("Failed to delete webhook");
            setWebhooks(webhooks().filter(h => h.id !== id));
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    };

    const testWebhook = async (id: number) => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/repos/${owner}/${repo}/hooks/${id}/tests`, {
                method: "POST",
                headers: withAuthHeaders()
            });
            if (!res.ok) throw new Error("Failed to deliver test payload");
            setSuccessMessage("Test payload delivered successfully");
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div class="repo-settings-view bg-root text-primary min-h-full">
            <div class="max-w-5xl mx-auto w-full p-8 pb-32">
                <header class="settings-header flex items-center justify-between mb-8 pb-6 border-b border-color">
                    <div>
                        <h1 class="text-2xl font-semibold m-0">{owner} / {repo}</h1>
                        <p class="text-muted m-0 text-sm mt-1">Repository Settings</p>
                    </div>
                </header>

                <div class="flex flex-col md:flex-row gap-8">
                    <nav class="settings-nav w-full md:w-64 flex-shrink-0 flex flex-col gap-1">
                        <button class={`nav-tab border border-transparent ${activeTab() === 'general' ? 'active shadow-sm' : 'hover:bg-panel-hover'}`} onClick={() => setActiveTab('general')}>
                            <Settings size={16} /> General
                        </button>
                        <button class={`nav-tab border border-transparent ${activeTab() === 'labels' ? 'active shadow-sm' : 'hover:bg-panel-hover'}`} onClick={() => setActiveTab('labels')}>
                            <Tag size={16} /> Labels
                            <span class="badge ml-auto">{labels().length || 0}</span>
                        </button>
                        <button class={`nav-tab border border-transparent ${activeTab() === 'milestones' ? 'active shadow-sm' : 'hover:bg-panel-hover'}`} onClick={() => setActiveTab('milestones')}>
                            <Target size={16} /> Milestones
                            <span class="badge ml-auto">{milestones().length || 0}</span>
                        </button>
                        <button class={`nav-tab border border-transparent ${activeTab() === 'webhooks' ? 'active shadow-sm' : 'hover:bg-panel-hover'}`} onClick={() => setActiveTab('webhooks')}>
                            <Webhook size={16} /> Webhooks
                            <span class="badge ml-auto">{webhooks().length || 0}</span>
                        </button>
                    </nav>

                    <div class="settings-content flex-1 min-w-0">
                        <Show when={errorMessage()}>
                            <div class="p-3 mb-6 bg-red/10 border border-red/20 text-red rounded-lg text-sm">{errorMessage()}</div>
                        </Show>
                        <Show when={successMessage()}>
                            <div class="p-3 mb-6 bg-green/10 border border-green/20 text-green rounded-lg text-sm flex items-center gap-2">
                                <CheckCircle2 size={16} /> {successMessage()}
                            </div>
                        </Show>
                        <Show when={isLoading()}>
                            <div class="p-8 text-center text-muted border border-color rounded-xl bg-panel">Loading settings...</div>
                        </Show>

                        <Show when={!isLoading()}>
                            <Show when={activeTab() === 'general'}>
                                <div class="settings-section animate-in">
                                    <h2 class="text-lg font-medium mb-4">General Settings</h2>
                                    <form class="bg-panel border border-color rounded-xl p-6 mb-8" onSubmit={updateGeneral}>
                                        <div class="form-group mb-4">
                                            <label class="block text-sm font-medium mb-1">Description</label>
                                            <input type="text" value={editDesc()} onInput={e => setEditDesc(e.currentTarget.value)} class="w-full bg-app border border-color rounded-lg px-3 py-2 text-primary focus:border-blue outline-none" />
                                        </div>
                                        <div class="form-group mb-6">
                                            <label class="block text-sm font-medium mb-1">Topics (comma separated)</label>
                                            <input type="text" value={editTopics()} onInput={e => setEditTopics(e.currentTarget.value)} class="w-full bg-app border border-color rounded-lg px-3 py-2 text-primary focus:border-blue outline-none" placeholder="e.g. typescript, web, api" />
                                        </div>
                                        <div class="form-group mb-6 flex items-center gap-3">
                                            <input type="checkbox" id="isPrivate" checked={editIsPrivate()} onChange={e => setEditIsPrivate(e.currentTarget.checked)} class="w-4 h-4 cursor-pointer" />
                                            <label for="isPrivate" class="text-sm font-medium cursor-pointer">Private Repository <span class="text-muted font-normal">(invisible to unauthenticated users)</span></label>
                                        </div>
                                        <div class="pt-4 border-t border-color flex justify-end">
                                            <button type="submit" class="btn btn-primary" disabled={isSaving()}>Save Changes</button>
                                        </div>
                                    </form>

                                    <h2 class="text-lg font-medium mb-4 text-red">Danger Zone</h2>
                                    <div class="bg-red/5 border border-red/20 rounded-xl p-6">
                                        <div class="flex items-center justify-between">
                                            <div>
                                                <h3 class="font-medium text-red m-0 mb-1">Delete this repository</h3>
                                                <p class="text-muted text-sm m-0">Once you delete a repository, there is no going back. Please be certain.</p>
                                            </div>
                                            <button class="btn border-red text-red hover:bg-red/10" onClick={deleteRepo} disabled={isSaving()}>Delete repository</button>
                                        </div>
                                    </div>
                                </div>
                            </Show>

                            <Show when={activeTab() === 'labels'}>
                                <div class="settings-section animate-in">
                                    <div class="flex items-center justify-between mb-4">
                                        <h2 class="text-lg font-medium m-0">Labels</h2>
                                        <Show when={!isCreatingLabel()}>
                                            <button class="btn btn-primary btn-sm flex items-center gap-1" onClick={() => setIsCreatingLabel(true)}>
                                                <Plus size={14} /> New Label
                                            </button>
                                        </Show>
                                    </div>
                                    <Show when={isCreatingLabel()}>
                                        <form class="bg-panel border border-color rounded-xl p-4 mb-6" onSubmit={createLabel}>
                                            <div class="flex gap-3 mb-4 items-end">
                                                <div class="flex-1">
                                                    <label class="block text-xs text-muted mb-1">Label Name</label>
                                                    <input type="text" required value={newLabelName()} onInput={e => setNewLabelName(e.currentTarget.value)} class="w-full bg-app border border-color rounded-lg px-3 py-1.5 outline-none focus:border-blue" />
                                                </div>
                                                <div class="flex-1">
                                                    <label class="block text-xs text-muted mb-1">Description</label>
                                                    <input type="text" value={newLabelDesc()} onInput={e => setNewLabelDesc(e.currentTarget.value)} class="w-full bg-app border border-color rounded-lg px-3 py-1.5 outline-none focus:border-blue" />
                                                </div>
                                                <div class="w-24">
                                                    <label class="block text-xs text-muted mb-1">Color</label>
                                                    <input type="color" value={newLabelColor()} onInput={e => setNewLabelColor(e.currentTarget.value)} class="w-full h-9 rounded cursor-pointer border-0 p-0" />
                                                </div>
                                            </div>
                                            <div class="flex justify-end gap-2">
                                                <button type="button" class="btn btn-sm" onClick={() => setIsCreatingLabel(false)}>Cancel</button>
                                                <button type="submit" class="btn btn-primary btn-sm" disabled={isSaving()}>Create Label</button>
                                            </div>
                                        </form>
                                    </Show>

                                    <div class="bg-panel border border-color rounded-xl overflow-hidden">
                                        <For each={labels()}>
                                            {(label) => (
                                                <div class="flex items-center justify-between p-4 border-b border-color last:border-b-0 hover:bg-panel-hover">
                                                    <div class="flex items-center gap-4 flex-1">
                                                        <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium border" style={{ "background-color": `${label.color}20`, color: label.color, "border-color": `${label.color}40` }}>
                                                            {label.name}
                                                        </span>
                                                        <span class="text-sm text-muted hidden md:inline">{label.description}</span>
                                                    </div>
                                                    <div class="flex gap-2">
                                                        <button class="text-muted hover:text-red p-1" onClick={() => void deleteLabel(label.id)} disabled={isSaving()}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                        <Show when={labels().length === 0}>
                                            <div class="p-8 text-center text-muted">No labels defined.</div>
                                        </Show>
                                    </div>
                                </div>
                            </Show>

                            <Show when={activeTab() === 'milestones'}>
                                <div class="settings-section animate-in">
                                    <div class="flex items-center justify-between mb-4">
                                        <h2 class="text-lg font-medium m-0">Milestones</h2>
                                        <Show when={!isCreatingMs()}>
                                            <button class="btn btn-primary btn-sm flex items-center gap-1" onClick={() => setIsCreatingMs(true)}>
                                                <Plus size={14} /> New Milestone
                                            </button>
                                        </Show>
                                    </div>
                                    <Show when={isCreatingMs()}>
                                        <form class="bg-panel border border-color rounded-xl p-4 mb-6" onSubmit={createMilestone}>
                                            <div class="grid gap-4 mb-4">
                                                <div>
                                                    <label class="block text-xs text-muted mb-1">Title</label>
                                                    <input type="text" required value={newMsTitle()} onInput={e => setNewMsTitle(e.currentTarget.value)} class="w-full bg-app border border-color rounded-lg px-3 py-1.5 outline-none focus:border-blue" />
                                                </div>
                                                <div>
                                                    <label class="block text-xs text-muted mb-1">Description</label>
                                                    <input type="text" value={newMsDesc()} onInput={e => setNewMsDesc(e.currentTarget.value)} class="w-full bg-app border border-color rounded-lg px-3 py-1.5 outline-none focus:border-blue" />
                                                </div>
                                                <div>
                                                    <label class="block text-xs text-muted mb-1">Due Date (Optional)</label>
                                                    <input type="date" value={newMsDueDate()} onInput={e => setNewMsDueDate(e.currentTarget.value)} class="w-full md:w-1/2 bg-app border border-color rounded-lg px-3 py-1.5 outline-none focus:border-blue" />
                                                </div>
                                            </div>
                                            <div class="flex justify-end gap-2 text-sm border-t border-color pt-4">
                                                <button type="button" class="btn btn-sm" onClick={() => setIsCreatingMs(false)}>Cancel</button>
                                                <button type="submit" class="btn btn-primary btn-sm" disabled={isSaving()}>Create Milestone</button>
                                            </div>
                                        </form>
                                    </Show>
                                    <div class="bg-panel border border-color rounded-xl overflow-hidden">
                                        <For each={milestones()}>
                                            {(ms) => (
                                                <div class="flex flex-col md:flex-row md:items-center justify-between p-5 border-b border-color last:border-b-0 hover:bg-panel-hover">
                                                    <div>
                                                        <div class="flex items-center gap-3 mb-1">
                                                            <h3 class="font-medium m-0 text-lg">{ms.title}</h3>
                                                            <span class={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${ms.state === 'open' ? 'bg-green/10 text-green' : 'bg-purple/10 text-purple'}`}>{ms.state}</span>
                                                        </div>
                                                        <p class="text-sm text-muted m-0 mb-2">{ms.description || "No description provided."}</p>
                                                        <Show when={ms.due_date}>
                                                            <span class="text-xs text-muted">Due by {new Date(ms.due_date!).toLocaleDateString()}</span>
                                                        </Show>
                                                    </div>
                                                    <div class="mt-3 md:mt-0 flex gap-2">
                                                        <button class="text-muted hover:text-red p-2" onClick={() => void deleteMilestone(ms.id)} disabled={isSaving()}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                        <Show when={milestones().length === 0}>
                                            <div class="p-8 text-center text-muted">No milestones created yet.</div>
                                        </Show>
                                    </div>
                                </div>
                            </Show>

                            <Show when={activeTab() === 'webhooks'}>
                                <div class="settings-section animate-in">
                                    <div class="flex items-center justify-between mb-4">
                                        <h2 class="text-lg font-medium m-0">Webhooks</h2>
                                        <Show when={!isCreatingHook()}>
                                            <button class="btn btn-primary btn-sm flex items-center gap-1" onClick={() => setIsCreatingHook(true)}>
                                                <Plus size={14} /> Add Webhook
                                            </button>
                                        </Show>
                                    </div>
                                    <Show when={isCreatingHook()}>
                                        <form class="bg-panel border border-color rounded-xl p-5 mb-6" onSubmit={createWebhook}>
                                            <div class="grid gap-4 mb-4">
                                                <div>
                                                    <label class="block text-sm text-muted mb-1">Payload URL</label>
                                                    <input type="url" required placeholder="https://..." value={newHookUrl()} onInput={e => setNewHookUrl(e.currentTarget.value)} class="w-full bg-app border border-color rounded-lg px-3 py-1.5 outline-none focus:border-blue" />
                                                </div>
                                                <div>
                                                    <label class="block text-sm text-muted mb-1">Secret (Optional)</label>
                                                    <input type="text" value={newHookSecret()} onInput={e => setNewHookSecret(e.currentTarget.value)} class="w-full bg-app border border-color rounded-lg px-3 py-1.5 outline-none focus:border-blue" />
                                                </div>
                                                <div>
                                                    <label class="block text-sm text-muted mb-1">Triggers on</label>
                                                    <div class="flex gap-4 mt-2">
                                                        <label class="flex items-center gap-2 cursor-pointer text-sm">
                                                            <input type="checkbox" checked={newHookEvents().includes('push')} onChange={e => setNewHookEvents(e.currentTarget.checked ? [...newHookEvents(), 'push'] : newHookEvents().filter(x => x !== 'push'))} /> Push events
                                                        </label>
                                                        <label class="flex items-center gap-2 cursor-pointer text-sm">
                                                            <input type="checkbox" checked={newHookEvents().includes('issues')} onChange={e => setNewHookEvents(e.currentTarget.checked ? [...newHookEvents(), 'issues'] : newHookEvents().filter(x => x !== 'issues'))} /> Issue events
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="flex justify-end gap-2 text-sm border-t border-color pt-4">
                                                <button type="button" class="btn btn-sm" onClick={() => setIsCreatingHook(false)}>Cancel</button>
                                                <button type="submit" class="btn btn-primary btn-sm" disabled={isSaving()}>Add Webhook</button>
                                            </div>
                                        </form>
                                    </Show>
                                    <div class="bg-panel border border-color rounded-xl overflow-hidden">
                                        <For each={webhooks()}>
                                            {(hook) => (
                                                <div class="flex items-center justify-between p-4 border-b border-color last:border-b-0 hover:bg-panel-hover group">
                                                    <div class="flex flex-col gap-1">
                                                        <div class="font-medium flex items-center gap-2">
                                                            <Webhook size={14} class="text-blue" />
                                                            {hook.url}
                                                        </div>
                                                        <div class="text-xs text-muted flex items-center gap-2">
                                                            <span>Triggers: <span class="font-mono bg-black/30 px-1 rounded">{hook.events.join(", ")}</span></span>
                                                            {hook.secret && <span>• Has secret</span>}
                                                            {hook.is_active ? <span class="text-green">• Active</span> : <span class="text-red">• Inactive</span>}
                                                        </div>
                                                    </div>
                                                    <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button class="btn btn-sm btn-secondary flex items-center gap-1" onClick={() => void testWebhook(hook.id)} title="Send test payload" disabled={isSaving()}>
                                                            <Send size={12} /> Test
                                                        </button>
                                                        <button class="text-muted hover:text-red p-2" onClick={() => void deleteWebhook(hook.id)} title="Delete webhook" disabled={isSaving()}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                        <Show when={webhooks().length === 0}>
                                            <div class="p-8 text-center text-muted">No webhooks configured.</div>
                                        </Show>
                                    </div>
                                </div>
                            </Show>
                        </Show>
                    </div>
                </div>
            </div>
        </div>
    );
}
