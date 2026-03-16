import { useParams } from "@solidjs/router";
import { createSignal, onMount, For, Show } from "solid-js";
import { FileText, Tag, PlusSquare } from "lucide-solid";
import { getCurrentRepoContext, repoApiFetch } from "../../lib/repoContext";
import { formatIssueLabelColor } from "./issueLabelColor";
import "./IssueCreateForm.css";

type IssueLabel = {
    id: number;
    name: string;
    color: string;
    description: string;
};

type IssueMilestone = {
    id: number;
    title: string;
    state: string;
};

export default function IssueCreateForm() {
    const [isHydrated, setIsHydrated] = createSignal(false);
    const [isSubmitting, setIsSubmitting] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [successMessage, setSuccessMessage] = createSignal<string | null>(null);

    // Form state
    const [title, setTitle] = createSignal("");
    const [body, setBody] = createSignal("");
    const [selectedLabels, setSelectedLabels] = createSignal<string[]>([]);
    const [selectedMilestone, setSelectedMilestone] = createSignal<number | null>(null);

    // Metadata state
    const [availableLabels, setAvailableLabels] = createSignal<IssueLabel[]>([]);
    const [availableMilestones, setAvailableMilestones] = createSignal<IssueMilestone[]>([]);
    const [isLoadingMetadata, setIsLoadingMetadata] = createSignal(false);

    const params = useParams<{ owner: string; repo: string }>();
    const context = () => ({ owner: params.owner ?? "", repo: params.repo ?? "" });

    const loadMetadata = async () => {
        setIsLoadingMetadata(true);
        try {
            const [labelsRes, milestonesRes] = await Promise.all([
                repoApiFetch(`/labels?per_page=100`, {}, context()),
                repoApiFetch(`/milestones?state=open&per_page=100`, {}, context()),
            ]);

            if (labelsRes.ok) {
                const labels = (await labelsRes.json()) as IssueLabel[];
                setAvailableLabels(Array.isArray(labels) ? labels : []);
            }
            if (milestonesRes.ok) {
                const milestones = (await milestonesRes.json()) as IssueMilestone[];
                setAvailableMilestones(Array.isArray(milestones) ? milestones : []);
            }
        } catch (error) {
            console.error("Failed to load issue metadata", error);
        } finally {
            setIsLoadingMetadata(false);
        }
    };

    onMount(() => {
        setIsHydrated(true);
        void loadMetadata();
    });

    const getCookieValue = (name: string): string | null => {
        if (typeof document === "undefined") return null;
        const prefix = `${name}=`;
        const parts = document.cookie.split(";").map((p) => p.trim());
        for (const part of parts) {
            if (part.startsWith(prefix)) {
                return decodeURIComponent(part.slice(prefix.length));
            }
        }
        return null;
    };

    const toggleLabel = (labelName: string) => {
        setSelectedLabels((prev) =>
            prev.includes(labelName) ? prev.filter((l) => l !== labelName) : [...prev, labelName]
        );
    };

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        const issueTitle = title().trim();
        if (!issueTitle) return;

        setIsSubmitting(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            const csrf = getCookieValue("__csrf");
            if (csrf) headers["X-CSRF-Token"] = csrf;

            const payload: any = {
                title: issueTitle,
                body: body().trim(),
            };

            if (selectedLabels().length > 0) {
                payload.labels = selectedLabels();
            }
            if (selectedMilestone() !== null) {
                payload.milestone = selectedMilestone();
            }

            const response = await repoApiFetch(`/issues`, {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
            }, context());

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || `Failed to create issue (${response.status})`);
            }

            const created = (await response.json()) as { number: number };
            setSuccessMessage(`Issue #${created.number} created successfully.`);

            // Redirect to the new issue after a short delay
            setTimeout(() => {
                window.location.href = `/${context().owner}/${context().repo}/issues/${created.number}`;
            }, 1500);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to create issue";
            setErrorMessage(message);
            setIsSubmitting(false); // Only reset submitting if there's an error (prevent double submit during redirect)
        }
    };

    return (
        <div class="issue-create-container" data-hydrated={isHydrated() ? "true" : "false"}>
            <header class="create-header animate-in stagger-1">
                <div class="header-icon-wrapper">
                    <PlusSquare size={24} class="text-green" />
                </div>
                <div class="header-text">
                    <h1>Create New Issue</h1>
                    <p class="text-muted">Open a new issue or feature request in {context().repo}.</p>
                </div>
            </header>

            <Show when={errorMessage()}>
                {(message) => <p class="text-red mb-4">{message()}</p>}
            </Show>
            <Show when={successMessage()}>
                {(message) => <p class="text-green mb-4">{message()}</p>}
            </Show>

            <div class="form-layout animate-in stagger-2">
                <form class="issue-form bg-panel border-color" onSubmit={(e) => void handleSubmit(e)}>
                    <div class="form-main">
                        <div class="form-group">
                            <label for="title">Title</label>
                            <input
                                type="text"
                                id="title"
                                placeholder="Add a short, descriptive title"
                                value={title()}
                                onInput={(e) => setTitle(e.currentTarget.value)}
                                autocomplete="off"
                                autofocus
                                required
                            />
                        </div>

                        <div class="form-group">
                            <label for="body" class="flex items-center gap-2">
                                <FileText size={16} class="text-muted" />
                                Description
                            </label>
                            <div class="composer-card">
                                <textarea
                                    id="body"
                                    class="w-full bg-transparent border-none p-4 text-[15px] resize-y min-h-[250px] focus:outline-none text-primary"
                                    placeholder="Describe the issue, bug, or feature request..."
                                    value={body()}
                                    onInput={(e) => setBody(e.currentTarget.value)}
                                ></textarea>
                            </div>
                        </div>

                        <div class="form-actions">
                            <button type="button" class="secondary-btn" onClick={() => window.history.back()} disabled={isSubmitting()}>
                                Cancel
                            </button>
                            <button type="submit" class="primary-btn submit-btn" disabled={!title().trim() || isSubmitting()}>
                                {isSubmitting() ? "Creating..." : "Submit New Issue"}
                            </button>
                        </div>
                    </div>

                    <div class="form-sidebar">
                        <div class="sidebar-section">
                            <h3 class="flex items-center gap-2 text-sm font-medium text-primary mb-3">
                                <Tag size={16} class="text-muted" />
                                Labels
                            </h3>
                            <Show when={isLoadingMetadata()}>
                                <p class="text-xs text-muted">Loading labels...</p>
                            </Show>
                            <Show when={!isLoadingMetadata() && availableLabels().length > 0}>
                                <div class="labels-list">
                                    <For each={availableLabels()}>
                                        {(label) => (
                                            <button
                                                type="button"
                                                class={`label-toggle-btn ${selectedLabels().includes(label.name) ? 'selected' : ''}`}
                                                onClick={() => toggleLabel(label.name)}
                                            >
                                                <span
                                                    class="label-color-dot"
                                                    style={`background-color: ${formatIssueLabelColor(label.color)}`}
                                                ></span>
                                                <span class="label-name">{label.name}</span>
                                            </button>
                                        )}
                                    </For>
                                </div>
                            </Show>
                            <Show when={!isLoadingMetadata() && availableLabels().length === 0}>
                                <p class="text-xs text-muted">No labels found.</p>
                            </Show>
                        </div>

                        <div class="sidebar-section">
                            <h3 class="flex items-center gap-2 text-sm font-medium text-primary mb-3">
                                Milestone
                            </h3>
                            <Show when={isLoadingMetadata()}>
                                <p class="text-xs text-muted">Loading milestones...</p>
                            </Show>
                            <Show when={!isLoadingMetadata() && availableMilestones().length > 0}>
                                <select
                                    class="milestone-select"
                                    value={selectedMilestone() || ""}
                                    onChange={(e) => setSelectedMilestone(e.currentTarget.value ? Number(e.currentTarget.value) : null)}
                                >
                                    <option value="">No milestone</option>
                                    <For each={availableMilestones()}>
                                        {(ms) => (
                                            <option value={ms.id}>{ms.title}</option>
                                        )}
                                    </For>
                                </select>
                            </Show>
                            <Show when={!isLoadingMetadata() && availableMilestones().length === 0}>
                                <p class="text-xs text-muted">No open milestones.</p>
                            </Show>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
