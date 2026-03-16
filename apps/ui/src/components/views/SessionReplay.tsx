import { useParams, A } from "@solidjs/router";
import { createResource, For, Show, createSignal, onMount } from 'solid-js';
import {
    ChevronLeft, MessageSquare, Wrench, Hash, FileCode, Play, Pause,
    Sparkles, User, Clock
} from 'lucide-solid';
import { apiFetch } from '../../lib/repoContext';
import { normalizePersistedAgentMessage, type AgentMessagePart } from '../../lib/agentMessages';
import './SessionReplay.css';

type SessionMessage = {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content?: string;
    parts?: AgentMessagePart[];
    tool_calls?: any[];
    token_count?: number;
    created_at: string;
};

type SessionEvent = {
    id: string;
    time: string;
    type: 'user' | 'agent' | 'tool';
    icon: any;
    action: string;
    text: string;
    color: string;
    tokens: string;
    active: boolean;
};

export default function SessionReplay() {
    const params = useParams<{ owner: string; repo: string; sessionId: string }>();
    const owner = () => params.owner ?? "";
    const repoName = () => params.repo ?? "";
    const sessionId = () => params.sessionId ?? "";

    const fetchSessionMeta = async () => {
        if (!sessionId()) return null;
        const res = await apiFetch(`/api/repos/${owner()}/${repoName()}/agent/sessions/${sessionId()}`);
        if (!res.ok) throw new Error("Failed to load session details");
        return res.json();
    };

    const fetchSessionMessages = async () => {
        if (!sessionId()) return [];
        const res = await apiFetch(`/api/repos/${owner()}/${repoName()}/agent/sessions/${sessionId()}/messages`);
        if (!res.ok) throw new Error("Failed to load messages");
        const msgs = await res.json() as SessionMessage[];

        const startTime = msgs.length ? new Date(msgs[0].created_at).getTime() : 0;

        return msgs.map((m: SessionMessage): SessionEvent => {
            const timeDiff = new Date(m.created_at).getTime() - startTime;
            const mins = Math.floor(timeDiff / 60000);
            const secs = Math.floor((timeDiff % 60000) / 1000);
            const timeStr = `+${mins}:${secs.toString().padStart(2, '0')}`;
            const normalized = normalizePersistedAgentMessage(m);

            let action = '';
            let text = normalized.text;
            let type:SessionEvent['type'] = m.role === 'user' ? 'user' : 'agent';
            let icon = m.role === 'user' ? User : Sparkles;
            let color = m.role === 'user' ? 'green' : 'blue';

            if (normalized.type !== 'text') {
                action = normalized.toolName || 'Tool';
                text = normalized.text || 'Executed tool';
                type = 'tool';
                icon = Wrench;
                color = 'yellow';
            }

            return {
                id: m.id,
                time: timeStr,
                type,
                icon,
                action,
                text,
                color,
                tokens: m.token_count ? String(m.token_count) : '',
                active: false
            };
        });
    };

    const [session] = createResource(sessionId, fetchSessionMeta);
    const [events] = createResource(sessionId, fetchSessionMessages);

    const [isPlaying, setIsPlaying] = createSignal(false);
    const [playbackSpeed, setPlaybackSpeed] = createSignal(1);
    const [currentIndex, setCurrentIndex] = createSignal(-1); // -1 = show all or none

    // Simple auto-playback simulation
    let playTimer: ReturnType<typeof setInterval> | null = null;
    const togglePlayback = () => {
        if (isPlaying()) {
            setIsPlaying(false);
            if (playTimer) clearInterval(playTimer);
        } else {
            setIsPlaying(true);
            if (currentIndex() >= (events()?.length || 0) - 1) {
                setCurrentIndex(0);
            }
            playTimer = setInterval(() => {
                if (currentIndex() < (events()?.length || 0) - 1) {
                    setCurrentIndex(c => c + 1);
                } else {
                    setIsPlaying(false);
                    if (playTimer) clearInterval(playTimer);
                }
            }, 1000 / playbackSpeed());
        }
    };

    const activeEvents = () => {
        if (!events()) return [];
        if (currentIndex() === -1) return events()!.map(e => ({ ...e, active: false }));
        return events()!.map((e, i) => ({ ...e, active: i === currentIndex() }));
    };

    const timelineBars = () => events()?.map(e => e.color) || [];

    const parseDuration = (ms: number) => {
        if (!ms) return "-";
        const seconds = Math.floor(ms / 1000);
        const mins = Math.floor(seconds / 60);
        if (mins > 0) return `${mins}m ${seconds % 60}s`;
        return `${seconds}s`;
    };

    return (
        <div class="session-container">
            <header class="session-header">
                <div class="breadcrumb">
                    <A href={`/${owner()}/${repoName()}/sessions`} class="text-blue flex items-center hover:underline">
                        <ChevronLeft size={16} class="mr-1" />
                        <span>Sessions</span>
                    </A>
                    <span class="separator">&nbsp;&nbsp;&nbsp;</span>
                    <h2 class="session-title-text truncate">Session Replay: {session()?.title || session()?.id?.slice(0, 8)}</h2>
                </div>
                <div class="session-count">{events()?.length || 0} events</div>
            </header>

            <Show when={session.loading || events.loading}>
                <div class="flex justify-center p-12">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </Show>

            <Show when={session() && events()}>
                <section class="task-summary">
                    <p class="task-description">
                        {session()?.title || "Agent conversation session details."}
                    </p>
                    <div class="task-meta">
                        <div class="badges">
                            <span class="badge blue">{repoName()}</span>
                            <span class="badge gray capitalize">{session()?.status}</span>
                            <span class="badge gray"><Clock size={12} class="mr-1 inline-block" /> {parseDuration(session()?.duration_ms)}</span>
                        </div>
                        <div class="stats">
                            <span title="Messages"><MessageSquare size={14} /> {events()?.filter(e => e.type !== 'tool').length || 0}</span>
                            <span title="Tool Calls"><Wrench size={14} /> {events()?.filter(e => e.type === 'tool').length || 0}</span>
                        </div>
                    </div>
                </section>

                <section class="timeline-widget">
                    <div class="timeline-bars">
                        <For each={timelineBars()}>
                            {(color, i) => (
                                <div class={`timeline-bar ${color} ${i() === currentIndex() ? 'active' : ''}`}
                                     style={{ "min-width": "4px", "margin-right": "2px" }}
                                     onClick={() => setCurrentIndex(i())}>
                                </div>
                            )}
                        </For>
                        {timelineBars().length > 0 && currentIndex() !== -1 && (
                            <div class="timeline-cursor" style={{ left: `${(currentIndex() / Math.max(1, timelineBars().length - 1)) * 100}%` }}></div>
                        )}
                    </div>
                    <div class="timeline-controls">
                        <div class="controls-row">
                            <div class="play-actions">
                                <button class="icon-btn text-blue" onClick={togglePlayback}>
                                    {isPlaying() ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                                </button>
                                <button class={`speed-btn ${playbackSpeed() === 1 ? 'active' : ''}`} onClick={() => setPlaybackSpeed(1)}>1x</button>
                                <button class={`speed-btn ${playbackSpeed() === 2 ? 'active' : ''}`} onClick={() => setPlaybackSpeed(2)}>2x</button>
                                <button class={`speed-btn ${playbackSpeed() === 4 ? 'active' : ''}`} onClick={() => setPlaybackSpeed(4)}>4x</button>
                            </div>
                            <div class="event-info">
                                <span class="text-muted text-sm">
                                    {currentIndex() !== -1 ? `Event ${currentIndex() + 1}/${events()?.length || 0}` : 'Timeline'}
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="log-stream">
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="m-0 font-medium">Session Logs</h4>
                        <button class="text-sm text-blue hover:underline" onClick={() => setCurrentIndex(-1)}>Show all logs</button>
                    </div>
                    <For each={activeEvents()}>
                        {(event, i) => (
                            <div class={`log-row ${event.active ? 'active' : ''}`} 
                                 style={{ display: (currentIndex() === -1 || currentIndex() === i()) ? 'flex' : 'none' }}>
                                <div class="log-time text-muted shrink-0 w-12">{event.time}</div>
                                <div class="log-icon shrink-0" classList={{ [event.color]: true }}>
                                    <event.icon size={14} />
                                </div>
                                <div class="log-content break-all">
                                    {event.action && <span class={`log-action ${event.color} mr-2`}>{event.action}</span>}
                                    <span class={event.type === 'agent' || event.type === 'user' ? 'log-text-primary' : 'log-text-muted text-sm'}>
                                        {event.text}
                                    </span>
                                </div>
                                {event.tokens && <div class="log-tokens text-muted shrink-0 ml-4">{event.tokens}t</div>}
                            </div>
                        )}
                    </For>
                </section>
            </Show>
        </div>
    );
}
