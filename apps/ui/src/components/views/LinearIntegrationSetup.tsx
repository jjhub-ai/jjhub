import { createEffect, createMemo, createResource, createSignal, For, onMount, Show } from 'solid-js';
import { Trash2, RefreshCw, Link2 } from 'lucide-solid';
import { apiFetch } from '../../lib/repoContext';
import { useAuth } from '../../layouts/AppLayout';

interface LinearIntegration {
    id: number;
    linear_team_id: string;
    linear_team_name: string;
    linear_team_key: string;
    repo_owner: string;
    repo_name: string;
    repo_id: number;
    is_active: boolean;
    last_sync_at: string | null;
    created_at: string;
}

interface LinearTeamOption {
    id: string;
    name: string;
    key: string;
}

interface PendingLinearSetup {
    setupKey: string;
    actorName: string;
    actorEmail: string;
    teams: LinearTeamOption[];
}

interface LinearRepositoryOption {
    id: number;
    owner: string;
    name: string;
    description: string;
}

interface RepoOption {
    id: number;
    owner: string;
    name: string;
    description: string;
}

async function readResponseMessage(res: Response, fallback: string): Promise<string> {
    const body = await res.json().catch(() => null);
    if (body && typeof body.message === 'string' && body.message.trim()) {
        return body.message;
    }
    return fallback;
}

export default function LinearIntegrationSetup() {
    const { user, isLoading: authLoading } = useAuth();
    const [isConnecting, setIsConnecting] = createSignal(false);
    const [isSubmitting, setIsSubmitting] = createSignal(false);
    const [statusMessage, setStatusMessage] = createSignal<string | null>(null);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [pendingSetup, setPendingSetup] = createSignal<PendingLinearSetup | null>(null);
    const [repoOptions, setRepoOptions] = createSignal<RepoOption[]>([]);
    const [isLoadingRepos, setIsLoadingRepos] = createSignal(false);
    const [repoOptionsLoaded, setRepoOptionsLoaded] = createSignal(false);
    const [selectedTeamID, setSelectedTeamID] = createSignal('');
    const [selectedRepoID, setSelectedRepoID] = createSignal<number | null>(null);

    const fetchIntegrations = async (): Promise<LinearIntegration[]> => {
        const res = await apiFetch('/api/integrations/linear');
        if (!res.ok) throw new Error('Failed to fetch Linear integrations');
        return res.json();
    };

    const [integrations, { refetch }] = createResource(fetchIntegrations);

    const selectedTeam = createMemo(() => {
        const setup = pendingSetup();
        if (!setup) return null;
        return setup.teams.find((team) => team.id === selectedTeamID()) ?? null;
    });

    const selectedRepo = createMemo(() => {
        const repoID = selectedRepoID();
        if (repoID === null) return null;
        return repoOptions().find((repo) => repo.id === repoID) ?? null;
    });

    const loadPendingSetup = async (setupKey: string) => {
        try {
            const res = await apiFetch(`/api/integrations/linear/setup/${encodeURIComponent(setupKey)}`);
            if (!res.ok) {
                throw new Error(await readResponseMessage(res, 'Failed to load the pending Linear setup.'));
            }

            const payload = await res.json() as {
                viewer?: { name?: string; email?: string };
                teams?: Array<{ id?: string; name?: string; key?: string }>;
            };
            const teams = Array.isArray(payload.teams)
                ? payload.teams
                    .map((team) => ({
                        id: String(team.id ?? ''),
                        name: String(team.name ?? ''),
                        key: String(team.key ?? ''),
                    }))
                    .filter((team) => team.id !== '')
                : [];

            if (teams.length === 0) {
                throw new Error('Linear OAuth completed, but no teams were returned.');
            }

            setPendingSetup({
                setupKey,
                actorName: payload.viewer?.name ?? '',
                actorEmail: payload.viewer?.email ?? '',
                teams,
            });
            setSelectedTeamID(teams[0]?.id ?? '');
            window.history.replaceState({}, '', '/integrations/linear');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load the pending Linear setup.';
            setErrorMessage(message);
        }
    };

    const parsePendingSetup = () => {
        if (typeof window === 'undefined') return;

        const params = new URLSearchParams(window.location.search);
        const setupKey = params.get('setup') ?? '';
        const returnedError = params.get('error');

        if (returnedError !== null) {
            window.history.replaceState({}, '', '/integrations/linear');
            setErrorMessage(returnedError);
        }

        if (!setupKey) {
            return;
        }

        void loadPendingSetup(setupKey);
    };

    const loadRepoOptions = async () => {
        setIsLoadingRepos(true);
        try {
            const res = await apiFetch('/api/integrations/linear/repositories');
            if (!res.ok) {
                throw new Error(await readResponseMessage(res, 'Failed to load repositories.'));
            }
            const repos: LinearRepositoryOption[] = await res.json();
            const options = repos.map((repo) => ({
                id: repo.id,
                owner: repo.owner,
                name: repo.name,
                description: repo.description,
            }));
            setRepoOptions(options);
            if (options.length > 0 && selectedRepoID() === null) {
                setSelectedRepoID(options[0].id);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load repositories.';
            setErrorMessage(message);
            setRepoOptions([]);
        } finally {
            setIsLoadingRepos(false);
            setRepoOptionsLoaded(true);
        }
    };

    onMount(() => {
        parsePendingSetup();
    });

    createEffect(() => {
        if (authLoading() || repoOptionsLoaded()) return;
        if (!pendingSetup() || !user()) return;
        void loadRepoOptions();
    });

    const handleConnect = () => {
        setIsConnecting(true);
        window.location.href = '/api/auth/linear';
    };

    const handleDelete = async (id: number) => {
        const res = await apiFetch(`/api/integrations/linear/${id}`, { method: 'DELETE' });
        if (res.ok) refetch();
    };

    const handleSync = async (id: number) => {
        await apiFetch(`/api/integrations/linear/${id}/sync`, { method: 'POST' });
        refetch();
    };

    const handleInstall = async () => {
        const setup = pendingSetup();
        const team = selectedTeam();
        const repo = selectedRepo();
        if (!setup || !team || !repo) {
            setErrorMessage('Pick both a Linear team and a JJHub repository.');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage(null);
        setStatusMessage(null);
        try {
            const res = await apiFetch('/api/integrations/linear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    setup_key: setup.setupKey,
                    linear_team_id: team.id,
                    linear_team_name: team.name,
                    linear_team_key: team.key,
                    repo_owner: repo.owner,
                    repo_name: repo.name,
                    repo_id: repo.id,
                }),
            });
            if (!res.ok) {
                throw new Error(await readResponseMessage(res, 'Failed to configure the Linear integration.'));
            }

            setPendingSetup(null);
            setRepoOptions([]);
            setRepoOptionsLoaded(false);
            setSelectedTeamID('');
            setSelectedRepoID(null);
            setStatusMessage(`Connected ${team.key || team.name} to ${repo.owner}/${repo.name}.`);
            await refetch();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to configure the Linear integration.';
            setErrorMessage(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div class="flex flex-col h-full w-full bg-app text-primary">
            <div class="p-6 border-b border-color">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="text-xl font-semibold mb-1">Linear Integration</h1>
                        <p class="text-sm text-muted">Sync issues and comments between JJHub and Linear. You can configure it here or from the CLI with <code>jjhub extension linear ...</code>.</p>
                    </div>
                    <button
                        class="btn btn-primary flex items-center gap-2"
                        onClick={handleConnect}
                        disabled={isConnecting()}
                    >
                        <Link2 size={16} />
                        {isConnecting() ? 'Connecting...' : 'Connect Linear'}
                    </button>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto p-6">
                <Show when={errorMessage()}>
                    <div class="mb-4 rounded-xl border border-red/20 bg-red/10 px-4 py-3 text-sm text-red">
                        {errorMessage()}
                    </div>
                </Show>

                <Show when={statusMessage()}>
                    <div class="mb-4 rounded-xl border border-green/20 bg-green/10 px-4 py-3 text-sm text-green">
                        {statusMessage()}
                    </div>
                </Show>

                <Show when={pendingSetup()}>
                    <div class="bg-panel border border-color rounded-xl p-5 mb-6">
                        <div class="mb-4">
                            <h2 class="text-lg font-semibold mb-1">Complete setup</h2>
                            <p class="text-sm text-muted">Choose the Linear team and JJHub repository to connect.</p>
                            <Show when={pendingSetup()?.actorName || pendingSetup()?.actorEmail}>
                                <p class="text-xs text-muted mt-2">
                                    Authorized as {pendingSetup()?.actorName || pendingSetup()?.actorEmail}
                                    <Show when={pendingSetup()?.actorEmail && pendingSetup()?.actorName && pendingSetup()?.actorEmail !== pendingSetup()?.actorName}>
                                        {' '}({pendingSetup()?.actorEmail})
                                    </Show>
                                </p>
                            </Show>
                        </div>

                        <Show
                            when={!isLoadingRepos()}
                            fallback={
                                <div class="flex justify-center py-8">
                                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                                </div>
                            }
                        >
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label class="flex flex-col gap-2">
                                    <span class="text-sm font-medium">Linear team</span>
                                    <select
                                        class="bg-root border border-color rounded-lg px-3 py-2 text-sm focus:border-blue transition-colors focus:outline-none"
                                        value={selectedTeamID()}
                                        onInput={(event) => setSelectedTeamID(event.currentTarget.value)}
                                        disabled={isSubmitting()}
                                    >
                                        <For each={pendingSetup()?.teams ?? []}>
                                            {(team) => (
                                                <option value={team.id}>
                                                    {team.key ? `${team.key} - ${team.name}` : team.name}
                                                </option>
                                            )}
                                        </For>
                                    </select>
                                </label>

                                <label class="flex flex-col gap-2">
                                    <span class="text-sm font-medium">JJHub repository</span>
                                    <select
                                        class="bg-root border border-color rounded-lg px-3 py-2 text-sm focus:border-blue transition-colors focus:outline-none"
                                        value={selectedRepoID() === null ? '' : String(selectedRepoID())}
                                        onInput={(event) => setSelectedRepoID(Number(event.currentTarget.value))}
                                        disabled={isSubmitting() || repoOptions().length === 0}
                                    >
                                        <Show when={repoOptions().length > 0} fallback={<option value="">No repositories available</option>}>
                                            <For each={repoOptions()}>
                                                {(repo) => (
                                                    <option value={repo.id}>
                                                        {repo.owner}/{repo.name}
                                                    </option>
                                                )}
                                            </For>
                                        </Show>
                                    </select>
                                </label>
                            </div>

                            <Show when={selectedRepo()?.description}>
                                <p class="text-xs text-muted mt-3">{selectedRepo()?.description}</p>
                            </Show>

                            <div class="mt-5 flex items-center justify-between gap-3">
                                <p class="text-xs text-muted">
                                    OAuth completed. JJHub is holding the Linear credentials server-side until you finish setup.
                                </p>
                                <button
                                    class="btn btn-primary"
                                    onClick={handleInstall}
                                    disabled={isSubmitting() || !selectedTeam() || !selectedRepo()}
                                >
                                    {isSubmitting() ? 'Connecting...' : 'Connect Team'}
                                </button>
                            </div>
                        </Show>
                    </div>
                </Show>

                <Show
                    when={!integrations.loading}
                    fallback={
                        <div class="flex justify-center p-12">
                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    }
                >
                    <Show
                        when={integrations()?.length}
                        fallback={
                            <div class="text-center p-12 text-muted">
                                <p class="text-lg mb-2">No Linear integrations configured</p>
                                <p class="text-sm">Click "Connect Linear" to link a Linear team to a repository, or use <code>jjhub extension linear install</code> from the CLI.</p>
                            </div>
                        }
                    >
                        <div class="space-y-4">
                            <For each={integrations()}>
                                {(integration) => (
                                    <div class="bg-panel border border-color rounded-xl p-5 flex items-center justify-between">
                                        <div class="flex-1">
                                            <div class="flex items-center gap-3 mb-2">
                                                <span class="font-semibold text-lg">
                                                    {integration.linear_team_key || integration.linear_team_name}
                                                </span>
                                                <span class="text-muted">&#8594;</span>
                                                <span class="font-mono text-sm">
                                                    {integration.repo_owner}/{integration.repo_name}
                                                </span>
                                                <span
                                                    class={`text-xs px-2 py-0.5 rounded-md ${
                                                        integration.is_active
                                                            ? 'bg-green/10 text-green border border-green/20'
                                                            : 'bg-red/10 text-red border border-red/20'
                                                    }`}
                                                >
                                                    {integration.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            <div class="flex items-center gap-4 text-xs text-muted">
                                                <span>Created {new Date(integration.created_at).toLocaleDateString()}</span>
                                                {integration.last_sync_at && (
                                                    <span>Last synced {new Date(integration.last_sync_at).toLocaleString()}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <button
                                                class="btn btn-sm flex items-center gap-1"
                                                onClick={() => handleSync(integration.id)}
                                                title="Trigger sync"
                                            >
                                                <RefreshCw size={14} />
                                            </button>
                                            <button
                                                class="btn btn-sm btn-danger flex items-center gap-1"
                                                onClick={() => handleDelete(integration.id)}
                                                title="Remove integration"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>
                    </Show>
                </Show>
            </div>
        </div>
    );
}
