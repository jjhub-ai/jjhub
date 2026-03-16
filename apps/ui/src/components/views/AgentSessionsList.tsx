import { useParams, A } from "@solidjs/router";
import { createResource, For, Show } from 'solid-js';
import { Bot, Clock, PlayCircle } from 'lucide-solid';
import { getCurrentRepoContext, apiFetch } from '../../lib/repoContext';

type AgentSession = {
    id: string;
    status: string;
    model: string;
    created_at: string;
    duration_ms: number;
    title?: string;
};

export default function AgentSessionsList() {
    const params = useParams<{ owner: string; repo: string }>();
    const ctx = () => ({ owner: params.owner ?? "", repo: params.repo ?? "" });

    const fetchSessions = async () => {
        const { owner, repo } = ctx();
        if (!owner || !repo) return [];
        const res = await apiFetch(`/api/repos/${owner}/${repo}/agent/sessions`);
        if (!res.ok) throw new Error("Failed to load sessions");
        return res.json() as Promise<AgentSession[]>;
    };

    const [sessions] = createResource(fetchSessions);

    const parseDuration = (ms: number) => {
        if (!ms) return "-";
        const seconds = Math.floor(ms / 1000);
        const mins = Math.floor(seconds / 60);
        if (mins > 0) return `${mins}m ${seconds % 60}s`;
        return `${seconds}s`;
    };

    return (
        <div class="workspaces-container">
            <header class="workspaces-header">
                <div>
                    <h2>Agent Sessions</h2>
                    <p class="text-muted">Review history and replays from agent interactions.</p>
                </div>
            </header>

            <Show when={sessions.loading}>
                <div class="flex justify-center p-12">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </Show>

            <Show when={sessions.error}>
                <div class="p-8 text-center text-red">
                    Failed to load agent sessions.
                </div>
            </Show>

            <Show when={sessions() && sessions()?.length === 0}>
                <div class="empty-state">
                    <Bot size={48} class="text-muted" style={{ "margin-bottom": "1rem" }} />
                    <h3>No agent sessions found</h3>
                    <p class="text-muted">You haven't interacted with the agent in this repository yet.</p>
                </div>
            </Show>

            <Show when={sessions() && sessions()!.length > 0}>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Session</th>
                            <th>Status</th>
                            <th>Model</th>
                            <th>Duration</th>
                            <th>Created At</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={sessions()}>
                            {(session) => (
                                <tr>
                                    <td>
                                        <div class="flex items-center gap-2">
                                            <Bot size={16} class="text-purple" />
                                            <span class="font-medium">{session.title || session.id.slice(0, 8)}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="items-center gap-1.5 px-2 py-0.5 rounded text-xs border border-color bg-app inline-flex">
                                            <span class={`w-2 h-2 rounded-full ${session.status === 'completed' || session.status === 'done' ? 'bg-green' :
                                                session.status === 'failed' ? 'bg-red' :
                                                    session.status === 'running' ? 'bg-blue animate-pulse' :
                                                        'bg-yellow'
                                                }`}></span>
                                            <span class="capitalize text-muted">{session.status}</span>
                                        </div>
                                    </td>
                                    <td class="text-muted">{session.model || 'Unknown'}</td>
                                    <td class="text-muted flexItemsCenter gap-1"><Clock size={12} /> {parseDuration(session.duration_ms)}</td>
                                    <td class="text-muted">{new Date(session.created_at).toLocaleString()}</td>
                                    <td class="table-actions">
                                        <A href={`/${ctx().owner}/${ctx().repo}/sessions/${session.id}`} class="btn icon-btn tooltip-trigger" title="Replay Session">
                                            <PlayCircle size={16} />
                                        </A>
                                    </td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </Show>
        </div>
    );
}
