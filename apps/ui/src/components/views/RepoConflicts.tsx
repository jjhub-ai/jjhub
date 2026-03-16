import { useParams } from "@solidjs/router";
import { createSignal, For, onMount, Show } from "solid-js";
import { FileDiff, AlertTriangle, CheckCircle2 } from "lucide-solid";
import { getCurrentRepoContext, repoApiFetch } from "../../lib/repoContext";

type ChangeSummary = {
    change_id: string;
    has_conflict: boolean;
};

type ChangeConflict = {
    file_path: string;
    conflict_type: string;
    resolution_status?: string;
};

type ChangeConflictGroup = {
    changeID: string;
    conflicts: ChangeConflict[];
};

export default function RepoConflicts() {
    const [isLoading, setIsLoading] = createSignal(true);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [conflicts, setConflicts] = createSignal<ChangeConflictGroup[]>([]);
    const params = useParams<{ owner: string; repo: string }>();
    const context = () => ({ owner: params.owner ?? "", repo: params.repo ?? "" });

    onMount(() => {
        void (async () => {
            setIsLoading(true);
            setErrorMessage(null);
            try {
                const changesResponse = await repoApiFetch("/changes?per_page=100", {}, context());
                if (!changesResponse.ok) {
                    throw new Error(`Failed to load changes (${changesResponse.status})`);
                }
                const changeBody = await changesResponse.json();
                const changeRows = (Array.isArray(changeBody) ? changeBody : (changeBody.items ?? [])) as ChangeSummary[];
                const conflictCandidates = changeRows.filter((row) => row.has_conflict);

                if (conflictCandidates.length === 0) {
                    setConflicts([]);
                    return;
                }

                const conflictGroups = await Promise.all(
                    conflictCandidates.map(async (row) => {
                        const response = await repoApiFetch(`/changes/${row.change_id}/conflicts`, {}, context());
                        if (!response.ok) {
                            throw new Error(`Failed to load conflicts for ${row.change_id} (${response.status})`);
                        }
                        const rows = (await response.json()) as ChangeConflict[];
                        return {
                            changeID: row.change_id,
                            conflicts: Array.isArray(rows) ? rows : [],
                        } satisfies ChangeConflictGroup;
                    })
                );

                setConflicts(conflictGroups);
            } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to load conflicts";
                setErrorMessage(message);
                setConflicts([]);
            } finally {
                setIsLoading(false);
            }
        })();
    });

    return (
        <div class="flex flex-col h-full w-full bg-app text-primary max-w-4xl mx-auto border-x border-color">
            <div class="p-6 border-b border-color">
                <div class="flex items-center gap-2 text-xl font-semibold">
                    <FileDiff size={20} class="text-red" />
                    <h1>Conflict Resolution</h1>
                </div>
                <p class="text-sm text-muted mt-1">Manage state conflicts natively in Jujutsu.</p>
            </div>

            <div class="flex-1 overflow-y-auto p-8">
                <Show when={isLoading()}>
                    <p class="text-muted">Loading conflicts...</p>
                </Show>

                <Show when={errorMessage()}>
                    {(message) => <p class="text-red">{message()}</p>}
                </Show>

                <Show when={!isLoading() && errorMessage() === null && conflicts().length === 0}>
                    <div class="text-center max-w-sm mx-auto mt-16">
                        <CheckCircle2 size={48} class="text-green mx-auto mb-4 opacity-80" />
                        <h2 class="text-lg font-medium mb-2">No Conflicts Detected</h2>
                        <p class="text-muted text-sm leading-relaxed">
                            Conflict scan completed. The current change stack is clean.
                        </p>
                    </div>
                </Show>

                <Show when={!isLoading() && errorMessage() === null && conflicts().length > 0}>
                    <div class="flex flex-col gap-4">
                        <div class="text-sm text-muted">
                            Found conflicts in {conflicts().length} change(s).
                        </div>

                        <For each={conflicts()}>
                            {(group) => (
                                <section class="border border-color bg-panel rounded-lg p-4">
                                    <div class="flex items-center gap-2 mb-3">
                                        <AlertTriangle size={16} class="text-red" />
                                        <h3 class="font-semibold">Change {group.changeID}</h3>
                                    </div>

                                    <Show when={group.conflicts.length > 0} fallback={<p class="text-sm text-muted">No file-level hunks were returned for this change.</p>}>
                                        <div class="flex flex-col gap-2">
                                            <For each={group.conflicts}>
                                                {(conflict) => (
                                                    <div class="border border-light rounded px-3 py-2 bg-app">
                                                        <div class="font-mono text-sm">{conflict.file_path}</div>
                                                        <div class="text-xs text-muted mt-1">
                                                            {conflict.conflict_type}
                                                            {conflict.resolution_status ? ` - ${conflict.resolution_status}` : ""}
                                                        </div>
                                                    </div>
                                                )}
                                            </For>
                                        </div>
                                    </Show>
                                </section>
                            )}
                        </For>
                    </div>
                </Show>
            </div>
        </div>
    );
}
