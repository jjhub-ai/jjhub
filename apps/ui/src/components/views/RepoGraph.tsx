import { useParams } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { Bookmark, GitBranchPlus, GitGraph, Hash, Maximize2, Minus, Plus, Search, Split } from "lucide-solid";
import { repoApiFetch } from "../../lib/repoContext";
import "./RepoGraph.css";

import { RepoChange } from "../../types/change";

type RepoBookmark = {
    name: string;
    target_change_id: string;
    target_commit_id: string;
    is_tracking_remote: boolean;
};

type GraphRow = {
    change: RepoChange;
    lane: number;
    laneCountBefore: number;
    laneCountAfter: number;
    parentLanes: number[];
    continuingLanes: number[];
};

type GraphLayout = {
    rows: GraphRow[];
    maxLaneCount: number;
};

const LANE_WIDTH = 26;
const ROW_HEIGHT = 64;
const NODE_Y = 24;
const EXIT_Y = ROW_HEIGHT;

function formatRelative(timestamp: string): string {
    const parsed = Date.parse(timestamp);
    if (Number.isNaN(parsed)) {
        return "recently";
    }
    const minutes = Math.max(1, Math.floor((Date.now() - parsed) / 60000));
    if (minutes < 60) {
        return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours}h ago`;
    }
    return `${Math.floor(hours / 24)}d ago`;
}

function laneCenter(lane: number): number {
    return lane * LANE_WIDTH + LANE_WIDTH / 2;
}

function uniqueParents(change: RepoChange): string[] {
    return Array.from(new Set((change.parent_change_ids ?? []).filter(Boolean)));
}

function buildGraphLayout(changes: RepoChange[]): GraphLayout {
    const activeLanes: string[] = [];
    const rows: GraphRow[] = [];
    let maxLaneCount = 1;

    for (const change of changes) {
        const lane = activeLanes.indexOf(change.change_id);
        const laneCountBefore = activeLanes.length;
        const parents = uniqueParents(change);

        const nextLanes = [...activeLanes];
        if (lane !== -1) {
            nextLanes.splice(lane, 1);
        }

        const actualLane = lane === -1 ? activeLanes.length : lane;

        let insertAt = actualLane;
        for (const parent of parents) {
            if (nextLanes.includes(parent)) {
                continue;
            }
            nextLanes.splice(insertAt, 0, parent);
            insertAt += 1;
        }

        const parentLanes = parents
            .map((parent) => nextLanes.indexOf(parent))
            .filter((parentLane) => parentLane >= 0);

        const continuingLanes = [];
        for (let i = 0; i < nextLanes.length; i++) {
            if (activeLanes.includes(nextLanes[i])) {
                continuingLanes.push(i);
            }
        }

        rows.push({
            change,
            lane: actualLane,
            laneCountBefore,
            laneCountAfter: nextLanes.length,
            parentLanes,
            continuingLanes,
        });

        activeLanes.splice(0, activeLanes.length, ...nextLanes);
        maxLaneCount = Math.max(maxLaneCount, laneCountBefore, activeLanes.length);
    }

    return { rows, maxLaneCount };
}

function statusTone(change: RepoChange): string {
    if (change.has_conflict) {
        return "danger";
    }
    if (change.is_empty) {
        return "muted";
    }
    return "ready";
}

function rowSvgWidth(maxLaneCount: number): number {
    return Math.max(maxLaneCount, 1) * LANE_WIDTH;
}

export default function RepoGraph() {
    const params = useParams<{ owner: string; repo: string }>();
    const [isLoading, setIsLoading] = createSignal(true);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [changes, setChanges] = createSignal<RepoChange[]>([]);
    const [bookmarks, setBookmarks] = createSignal<RepoBookmark[]>([]);
    const [revset, setRevset] = createSignal("all()");
    const [zoom, setZoom] = createSignal(1);

    const repoContext = () => ({
        owner: params.owner ?? "",
        repo: params.repo ?? "",
    });
    const repoName = () => params.repo ?? "";

    const layout = createMemo(() => buildGraphLayout(changes()));
    const graphRows = createMemo(() => layout().rows);
    const maxLaneCount = createMemo(() => layout().maxLaneCount);
    const rootCount = createMemo(() => changes().filter((change) => uniqueParents(change).length === 0).length);
    const mergeCount = createMemo(() => changes().filter((change) => uniqueParents(change).length > 1).length);

    const bookmarkMap = createMemo(() => {
        const map = new Map<string, string[]>();
        for (const b of bookmarks()) {
            if (!map.has(b.target_change_id)) {
                map.set(b.target_change_id, []);
            }
            map.get(b.target_change_id)!.push(b.name);
        }
        return map;
    });

    createEffect(() => {
        const context = repoContext();
        if (!context.owner || !context.repo) {
            return;
        }

        const currentRevset = revset();

        void (async () => {
            setIsLoading(true);
            setErrorMessage(null);
            try {
                // Fetch changes and bookmarks in parallel
                const [changesRes, bookmarksRes] = await Promise.all([
                    repoApiFetch(`/changes?per_page=100&revset=${encodeURIComponent(currentRevset)}`, {}, context),
                    repoApiFetch("/bookmarks?per_page=200", {}, context),
                ]);

                if (!changesRes.ok) {
                    throw new Error(`Failed to load changes (${changesRes.status})`);
                }

                const changesBody = await changesRes.json();
                const items = Array.isArray(changesBody) ? changesBody : (changesBody.items ?? []);
                setChanges(items as RepoChange[]);

                if (bookmarksRes.ok) {
                    const bookmarksBody = await bookmarksRes.json();
                    const bItems = Array.isArray(bookmarksBody) ? bookmarksBody : (bookmarksBody.items ?? []);
                    setBookmarks(bItems as RepoBookmark[]);
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to load change graph";
                setErrorMessage(message);
                setChanges([]);
            } finally {
                setIsLoading(false);
            }
        })();
    });

    const handleZoomIn = () => setZoom((z) => Math.min(z + 0.1, 2));
    const handleZoomOut = () => setZoom((z) => Math.max(z - 0.1, 0.5));
    const handleResetZoom = () => setZoom(1);

    return (
        <div class="repo-graph-page">
            <div class="repo-graph-header">
                <div class="repo-graph-title">
                    <GitGraph size={20} class="text-secondary" />
                    <h1>Change Graph</h1>
                    <div class="repo-graph-subtitle-container">
                        <span class="repo-graph-subtitle">jj revset</span>
                        <Search size={12} class="text-muted" />
                        <input
                            type="text"
                            class="repo-graph-revset-input"
                            value={revset()}
                            onBlur={(e) => setRevset(e.currentTarget.value)}
                            onKeyDown={(e) => e.key === "Enter" && setRevset(e.currentTarget.value)}
                        />
                    </div>
                </div>
                <button
                    class="btn hover:bg-hover border border-color flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors"
                    onClick={() => {
                        const body = document.querySelector(".repo-graph-body");
                        if (body) body.requestFullscreen();
                    }}
                >
                    <Maximize2 size={14} /> <span class="text-sm font-medium">Fullscreen</span>
                </button>
            </div>

            <div class="repo-graph-summary">
                <div class="repo-graph-summary-card">
                    <GitBranchPlus size={16} />
                    <span>
                        {changes().length} change(s) loaded
                    </span>
                </div>
                <div class="repo-graph-summary-card">
                    <Split size={16} />
                    <span>{maxLaneCount()} active lane(s)</span>
                </div>
                <div class="repo-graph-summary-card">
                    <span>{rootCount()} root</span>
                    <span class="repo-graph-summary-separator">/</span>
                    <span>{mergeCount()} merge</span>
                </div>
            </div>

            <div class="repo-graph-body">
                <div class="repo-graph-viewport">
                    <Show when={isLoading()}>
                        <div class="p-8 text-center text-muted">Loading change graph...</div>
                    </Show>

                    <Show when={errorMessage()}>
                        {(message) => <div class="p-8 text-center text-red">{message()}</div>}
                    </Show>

                    <Show when={!isLoading() && errorMessage() === null && changes().length === 0}>
                        <div class="repo-graph-empty">
                            <GitGraph size={48} class="text-muted mx-auto mb-4 opacity-70" />
                            <h2>No changes found</h2>
                            <p>Try a different revset or import changes to populate the graph.</p>
                        </div>
                    </Show>

                    <Show when={!isLoading() && errorMessage() === null && changes().length > 0}>
                        <div
                            class="repo-graph-canvas"
                            style={{ transform: `scale(${zoom()})` }}
                        >
                            <div class="repo-graph-list">
                                <For each={graphRows()}>
                                    {(row) => {
                                        const width = rowSvgWidth(maxLaneCount());
                                        const changeBookmarks = () => bookmarkMap().get(row.change.change_id) || [];
                                        return (
                                            <div
                                                class="repo-graph-row"
                                                data-testid={`graph-row-${row.change.change_id}`}
                                            >
                                                <svg
                                                    class="repo-graph-svg"
                                                    width={width}
                                                    height={ROW_HEIGHT}
                                                    viewBox={`0 0 ${width} ${ROW_HEIGHT}`}
                                                    aria-hidden="true"
                                                >
                                                    {/* Continuing lanes from top to bottom */}
                                                    <For each={row.continuingLanes}>
                                                        {(laneIndex) => (
                                                            <line
                                                                class={`repo-graph-line lane-${laneIndex % 10}`}
                                                                x1={laneCenter(laneIndex)}
                                                                y1="0"
                                                                x2={laneCenter(laneIndex)}
                                                                y2={String(EXIT_Y)}
                                                            />
                                                        )}
                                                    </For>

                                                    {/* Lane entering from top to the node */}
                                                    <Show when={row.laneCountBefore > row.lane}>
                                                        <line
                                                            class={`repo-graph-line lane-${row.lane % 10}`}
                                                            x1={laneCenter(row.lane)}
                                                            y1="0"
                                                            x2={laneCenter(row.lane)}
                                                            y2={String(NODE_Y)}
                                                        />
                                                    </Show>

                                                    {/* Bezier connectors to parent lanes */}
                                                    <For each={row.parentLanes}>
                                                        {(parentLane) => (
                                                            <path
                                                                class={`repo-graph-connector lane-${row.lane % 10}`}
                                                                d={`M ${laneCenter(row.lane)} ${NODE_Y} C ${laneCenter(row.lane)} ${NODE_Y + (EXIT_Y - NODE_Y) / 2}, ${laneCenter(parentLane)} ${NODE_Y + (EXIT_Y - NODE_Y) / 2}, ${laneCenter(parentLane)} ${EXIT_Y}`}
                                                            />
                                                        )}
                                                    </For>

                                                    {/* The node itself */}
                                                    <circle
                                                        class={`repo-graph-node repo-graph-node-${statusTone(row.change)} lane-${row.lane % 10}`}
                                                        cx={laneCenter(row.lane)}
                                                        cy={NODE_Y}
                                                        r="6"
                                                    />
                                                </svg>

                                                <div class="repo-graph-card">
                                                    <div class="repo-graph-card-header">
                                                        <div class="min-w-0 flex-1">
                                                            <div class="repo-graph-description">
                                                                {row.change.description || "(empty description)"}
                                                            </div>
                                                            <div class="repo-graph-meta">
                                                                <span class={`repo-graph-status repo-graph-status-${statusTone(row.change)}`}>
                                                                    {row.change.has_conflict ? "conflict" : row.change.is_empty ? "empty" : "ready"}
                                                                </span>
                                                                <span>{row.change.author_name || "Unknown author"}</span>
                                                                <span>{formatRelative(row.change.timestamp)}</span>
                                                            </div>
                                                        </div>
                                                        <div class="repo-graph-lane-tag">
                                                            lane {row.lane}
                                                        </div>
                                                    </div>

                                                    <div class="repo-graph-identifiers">
                                                        <span class="repo-graph-pill">
                                                            <Hash size={10} />
                                                            {row.change.change_id.slice(0, 12)}
                                                        </span>
                                                        <span class="repo-graph-pill repo-graph-pill-commit">
                                                            {row.change.commit_id.slice(0, 12)}
                                                        </span>
                                                        <For each={changeBookmarks()}>
                                                            {(name) => (
                                                                <span class="repo-graph-bookmark-pill">
                                                                    <Bookmark size={10} />
                                                                    {name}
                                                                </span>
                                                            )}
                                                        </For>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }}
                                </For>
                            </div>
                        </div>
                    </Show>
                </div>

                <div class="repo-graph-zoom-controls">
                    <button class="repo-graph-zoom-btn" onClick={handleZoomIn} title="Zoom In">
                        <Plus size={18} />
                    </button>
                    <button class="repo-graph-zoom-btn" onClick={handleZoomOut} title="Zoom Out">
                        <Minus size={18} />
                    </button>
                    <button class="repo-graph-zoom-btn text-xs font-bold" onClick={handleResetZoom} title="Reset Zoom">
                        1:1
                    </button>
                </div>
            </div>
        </div>
    );
}
