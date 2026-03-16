import { createEffect, createSignal, For, onMount, Show } from "solid-js";
import { useParams } from "@solidjs/router";
import { useStore } from "@nanostores/solid";
import { CheckCircle2, CircleDot, Edit3, MessageSquare, X } from "lucide-solid";
import { isCommandPaletteOpen, isKeyboardHelpOpen, toggleAgentDock } from "../../stores/workbench";
import PrefetchLink from "../PrefetchLink";
import { apiFetch, repoApiFetch } from "../../lib/repoContext";
import { useKeyboardActionTarget, useSingleKeyShortcuts } from "../../lib/keyboard";
import ShortcutBadge from "../keyboard/ShortcutBadge";
import { formatIssueLabelColor } from "./issueLabelColor";
import {
    issueDetailResource,
    issuesListResource,
    type IssueCommentResponse,
    type IssueDetailResponse,
    type IssueSummary,
} from "../../lib/navigationData";
import { setCachedValue } from "../../lib/prefetchCache";
import "./IssueDetail.css";

type UserSearchResult = {
    id: number;
    username: string;
    display_name: string;
};

type UserSearchApiResult = {
    id: number;
    username?: string;
    display_name?: string;
    login?: string;
    name?: string;
};

function normalizeUserSearchResult(user: UserSearchApiResult): UserSearchResult | null {
    const username = user.username ?? user.login;
    if (!username) {
        return null;
    }

    return {
        id: user.id,
        username,
        display_name: user.display_name ?? user.name ?? username,
    };
}
function getCookieValue(name: string): string | null {
    if (typeof document === "undefined") {
        return null;
    }

    const prefix = `${name}=`;
    const parts = document.cookie.split(";").map((part) => part.trim());
    for (const part of parts) {
        if (part.startsWith(prefix)) {
            return decodeURIComponent(part.slice(prefix.length));
        }
    }
    return null;
}

function relativeTime(timestamp: string): string {
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

export default function IssueDetail() {
    const params = useParams<{ owner: string; repo: string; id: string }>();
    const props = { get id() { return params.id; } };
    const $isCommandPaletteOpen = useStore(isCommandPaletteOpen);
    const $isKeyboardHelpOpen = useStore(isKeyboardHelpOpen);
    const context = () => ({ owner: params.owner ?? "", repo: params.repo ?? "" });
    const initialBundle = issueDetailResource.peek(context(), props.id);

    const [issue, setIssue] = createSignal<IssueDetailResponse | null>(initialBundle?.issue ?? null);
    const [comments, setComments] = createSignal<IssueCommentResponse[]>(initialBundle?.comments ?? []);
    const [isLoading, setIsLoading] = createSignal(initialBundle === undefined);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [commentText, setCommentText] = createSignal("");
    const [isEditingTitle, setIsEditingTitle] = createSignal(false);
    const [titleDraft, setTitleDraft] = createSignal(initialBundle?.issue.title ?? "");
    const [isSaving, setIsSaving] = createSignal(false);
    const [activeEditor, setActiveEditor] = createSignal<"assignees" | "labels" | null>(null);
    const [editorErrorMessage, setEditorErrorMessage] = createSignal<string | null>(null);
    const [editorSearch, setEditorSearch] = createSignal("");
    const [availableLabels, setAvailableLabels] = createSignal<IssueLabel[]>([]);
    const [availableAssignees, setAvailableAssignees] = createSignal<UserSearchResult[]>([]);
    const [draftAssignees, setDraftAssignees] = createSignal<string[]>([]);
    const [draftLabels, setDraftLabels] = createSignal<string[]>([]);
    const [isEditorLoading, setIsEditorLoading] = createSignal(false);

    let commentInputRef: HTMLTextAreaElement | undefined;
    let editorSearchRef: HTMLInputElement | undefined;

    const keyboardActionsEnabled = () => !$isCommandPaletteOpen() && !$isKeyboardHelpOpen() && activeEditor() === null;

    const loadIssue = async () => {
        const cachedBundle = issueDetailResource.peek(context(), props.id);
        if (cachedBundle) {
            setIssue(cachedBundle.issue);
            setComments(cachedBundle.comments);
            setTitleDraft(cachedBundle.issue.title);
        }

        setIsLoading(!cachedBundle);
        setErrorMessage(null);
        try {
            const bundle = await issueDetailResource.load(context(), props.id);
            setIssue(bundle.issue);
            setTitleDraft(bundle.issue.title);
            setComments(bundle.comments);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load issue detail";
            setErrorMessage(message);
        } finally {
            setIsLoading(false);
        }
    };

    onMount(() => {
        void loadIssue();
    });

    const buildWriteHeaders = () => {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        const csrf = getCookieValue("__csrf");
        if (csrf) {
            headers["X-CSRF-Token"] = csrf;
        }
        return headers;
    };

    const syncIssueListCache = (updated: IssueDetailResponse) => {
        const cachedIssues = issuesListResource.peek(context());
        if (!cachedIssues) {
            return;
        }

        const nextIssues = cachedIssues.map((entry): IssueSummary => {
            if (entry.number !== updated.number) {
                return entry;
            }

            return {
                ...entry,
                title: updated.title,
                body: updated.body,
                state: updated.state,
                author: updated.author,
                labels: updated.labels,
                comment_count: updated.comment_count,
                created_at: updated.created_at,
                updated_at: updated.updated_at,
            };
        });

        setCachedValue(issuesListResource.key(context()), nextIssues);
    };

    const patchIssue = async (payload: Record<string, unknown>) => {
        const response = await repoApiFetch(`/issues/${props.id}`, {
            method: "PATCH",
            headers: buildWriteHeaders(),
            body: JSON.stringify(payload),
        }, context());
        if (!response.ok) {
            throw new Error(`Failed to update issue (${response.status})`);
        }
        const updated = (await response.json()) as IssueDetailResponse;
        setIssue(updated);
        setTitleDraft(updated.title);
        setCachedValue(issueDetailResource.key(context(), props.id), {
            issue: updated,
            comments: comments(),
        });
        syncIssueListCache(updated);
    };

    const focusCommentComposer = () => {
        commentInputRef?.focus();
        commentInputRef?.scrollIntoView({ block: "center", behavior: "smooth" });
    };

    const ensureLabelsLoaded = async () => {
        if (availableLabels().length > 0) {
            return;
        }

        const response = await repoApiFetch("/labels?per_page=100", {}, context());
        if (!response.ok) {
            throw new Error(`Failed to load labels (${response.status})`);
        }

        const labels = (await response.json()) as IssueLabel[];
        setAvailableLabels(Array.isArray(labels) ? labels : []);
    };

    const searchUsers = async (query: string) => {
        const trimmed = query.trim();
        if (!trimmed) {
            const currentAssignees = issue()?.assignees.map((assignee) => ({
                id: assignee.id,
                username: assignee.login,
                display_name: assignee.login,
            })) ?? [];
            setAvailableAssignees(currentAssignees);
            return;
        }

        const response = await apiFetch(`/api/search/users?q=${encodeURIComponent(trimmed)}&per_page=8`);
        if (!response.ok) {
            throw new Error(`Failed to search users (${response.status})`);
        }

        const body = await response.json();
        const items = Array.isArray(body?.items) ? body.items : [];
        setAvailableAssignees(
            items
                .map((item) => normalizeUserSearchResult(item as UserSearchApiResult))
                .filter((item): item is UserSearchResult => item !== null),
        );
    };

    const openAssigneeEditor = async () => {
        const currentIssue = issue();
        if (!currentIssue) {
            return;
        }

        setEditorErrorMessage(null);
        setEditorSearch("");
        setDraftAssignees(currentIssue.assignees.map((assignee) => assignee.login));
        setAvailableAssignees(
            currentIssue.assignees.map((assignee) => ({
                id: assignee.id,
                username: assignee.login,
                display_name: assignee.login,
            })),
        );
        setActiveEditor("assignees");
    };

    const openLabelEditor = async () => {
        const currentIssue = issue();
        if (!currentIssue) {
            return;
        }

        setEditorErrorMessage(null);
        setEditorSearch("");
        setDraftLabels(currentIssue.labels.map((label) => label.name));
        setIsEditorLoading(true);
        try {
            await ensureLabelsLoaded();
            setActiveEditor("labels");
        } catch (error) {
            setEditorErrorMessage(error instanceof Error ? error.message : "Failed to load labels");
        } finally {
            setIsEditorLoading(false);
        }
    };

    const closeEditor = () => {
        setActiveEditor(null);
        setEditorSearch("");
        setEditorErrorMessage(null);
    };

    const toggleAssignee = (login: string) => {
        setDraftAssignees((prev) =>
            prev.includes(login) ? prev.filter((entry) => entry !== login) : [...prev, login],
        );
    };

    const toggleLabel = (name: string) => {
        setDraftLabels((prev) =>
            prev.includes(name) ? prev.filter((entry) => entry !== name) : [...prev, name],
        );
    };

    const saveEditorChanges = async () => {
        const editor = activeEditor();
        if (!editor) {
            return;
        }

        setIsSaving(true);
        setEditorErrorMessage(null);
        try {
            if (editor === "assignees") {
                await patchIssue({ assignees: draftAssignees() });
            } else {
                await patchIssue({ labels: draftLabels() });
            }
            closeEditor();
        } catch (error) {
            setEditorErrorMessage(error instanceof Error ? error.message : "Failed to update issue");
        } finally {
            setIsSaving(false);
        }
    };

    const filteredLabels = () => {
        const needle = editorSearch().trim().toLowerCase();
        if (!needle) {
            return availableLabels();
        }

        return availableLabels().filter((label) =>
            `${label.name} ${label.description ?? ""}`.toLowerCase().includes(needle),
        );
    };

    useSingleKeyShortcuts({
        bindings: () => [
            { key: "c", action: focusCommentComposer },
            { key: "a", action: () => void openAssigneeEditor() },
            { key: "l", action: () => void openLabelEditor() },
        ],
        enabled: keyboardActionsEnabled,
    });

    useKeyboardActionTarget({
        comment: focusCommentComposer,
        assign: () => void openAssigneeEditor(),
        label: () => void openLabelEditor(),
    }, keyboardActionsEnabled);

    createEffect(() => {
        if (!activeEditor()) {
            return;
        }

        window.setTimeout(() => editorSearchRef?.focus(), 0);
    });

    const submitTitle = async () => {
        const nextTitle = titleDraft().trim();
        if (!nextTitle || !issue()) {
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);
        try {
            await patchIssue({ title: nextTitle });
            setIsEditingTitle(false);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to update title";
            setErrorMessage(message);
        } finally {
            setIsSaving(false);
        }
    };

    const toggleState = async () => {
        const current = issue();
        if (!current) {
            return;
        }
        const nextState = current.state === "open" ? "closed" : "open";

        setIsSaving(true);
        setErrorMessage(null);
        try {
            await patchIssue({ state: nextState });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to update state";
            setErrorMessage(message);
        } finally {
            setIsSaving(false);
        }
    };

    const submitComment = async () => {
        const body = commentText().trim();
        if (!body) {
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);
        try {
            const response = await repoApiFetch(`/issues/${props.id}/comments`, {
                method: "POST",
                headers: buildWriteHeaders(),
                body: JSON.stringify({ body }),
            }, context());
            if (!response.ok) {
                throw new Error(`Failed to comment (${response.status})`);
            }

            const created = (await response.json()) as IssueCommentResponse;
            const nextComments = [...comments(), created];
            const currentIssue = issue();
            const nextIssue = currentIssue
                ? {
                    ...currentIssue,
                    comment_count: currentIssue.comment_count + 1,
                    updated_at: created.updated_at || created.created_at,
                }
                : null;

            setComments(nextComments);
            setIssue(nextIssue);
            setCommentText("");
            if (nextIssue) {
                setCachedValue(issueDetailResource.key(context(), props.id), {
                    issue: nextIssue,
                    comments: nextComments,
                });
                syncIssueListCache(nextIssue);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to post comment";
            setErrorMessage(message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div class="issue-detail-view flex h-full w-full bg-root text-primary overflow-hidden">
            <div class="flex-1 flex flex-col overflow-y-auto">
                <div class="max-w-5xl mx-auto w-full p-8 pb-32">
                    <Show when={isLoading()}>
                        <p class="text-muted">Loading issue...</p>
                    </Show>
                    <Show when={errorMessage()}>
                        <p class="text-red mb-4">{errorMessage()}</p>
                    </Show>

                    <Show when={issue()}>
                        {(currentIssue) => (
                            <>
                                <div class="issue-header mb-8">
                                    <div class="flex items-center gap-2 mb-3 text-sm text-muted">
                                        <PrefetchLink
                                            href={`/${context().owner}/${context().repo}/issues`}
                                            class="hover:text-primary transition-colors"
                                            prefetch={() => issuesListResource.prefetch(context())}
                                        >
                                            Issues
                                        </PrefetchLink>
                                        <span>/</span>
                                        <span>#{currentIssue().number}</span>
                                    </div>

                                    <div class="flex items-start justify-between gap-4">
                                        <div class="flex-1">
                                            <Show
                                                when={isEditingTitle()}
                                                fallback={
                                                    <h1 data-testid="issue-title" class="text-2xl font-semibold flex items-center gap-3 group">
                                                        <span>{currentIssue().title}</span>
                                                        <button
                                                            class="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-primary"
                                                            onClick={() => setIsEditingTitle(true)}
                                                            aria-label="Edit title"
                                                        >
                                                            <Edit3 size={16} />
                                                        </button>
                                                    </h1>
                                                }
                                            >
                                                <div class="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={titleDraft()}
                                                        onInput={(event) => setTitleDraft(event.currentTarget.value)}
                                                        class="flex-1 bg-panel border border-blue rounded-md px-3 py-1.5 text-xl font-semibold focus:outline-none"
                                                    />
                                                    <button class="btn btn-primary" disabled={isSaving()} onClick={() => void submitTitle()}>
                                                        Save
                                                    </button>
                                                    <button class="btn" onClick={() => setIsEditingTitle(false)}>
                                                        Cancel
                                                    </button>
                                                </div>
                                            </Show>

                                            <div class="flex items-center gap-3 mt-4 text-sm text-muted">
                                                <span
                                                    class={`issue-status px-2 py-0.5 rounded-full flex items-center gap-1.5 font-medium ${currentIssue().state === "open"
                                                            ? "open text-green border border-green/30 bg-green/10"
                                                            : "text-purple border border-purple/30 bg-purple/10"
                                                        }`}
                                                >
                                                    <Show when={currentIssue().state === "open"} fallback={<CheckCircle2 size={14} />}>
                                                        <CircleDot size={14} />
                                                    </Show>
                                                    {currentIssue().state === "open" ? "Open" : "Closed"}
                                                </span>
                                                <span>
                                                    <strong class="text-primary font-medium">{currentIssue().author.login}</strong> opened{" "}
                                                    {relativeTime(currentIssue().created_at)}
                                                </span>
                                                <span>·</span>
                                                <span>{currentIssue().comment_count} comments</span>
                                            </div>

                                            <div class="issue-meta-actions">
                                                <button type="button" class="issue-meta-button" onClick={() => void openAssigneeEditor()}>
                                                    <div class="issue-meta-header">
                                                        <span>Assignees</span>
                                                        <ShortcutBadge shortcutId="issue.assign" />
                                                    </div>
                                                    <div class="issue-meta-values">
                                                        <Show when={currentIssue().assignees.length > 0} fallback={<span class="issue-meta-empty">Unassigned</span>}>
                                                            <For each={currentIssue().assignees}>
                                                                {(assignee) => <span class="issue-meta-chip">@{assignee.login}</span>}
                                                            </For>
                                                        </Show>
                                                    </div>
                                                </button>

                                                <button type="button" class="issue-meta-button" onClick={() => void openLabelEditor()}>
                                                    <div class="issue-meta-header">
                                                        <span>Labels</span>
                                                        <ShortcutBadge shortcutId="issue.labels" />
                                                    </div>
                                                    <div class="issue-meta-values">
                                                        <Show when={currentIssue().labels.length > 0} fallback={<span class="issue-meta-empty">No labels</span>}>
                                                            <For each={currentIssue().labels}>
                                                                {(label) => (
                                                                    <span
                                                                        class="issue-meta-chip issue-meta-chip-label"
                                                                        style={{
                                                                            "border-color": formatIssueLabelColor(label.color),
                                                                            color: formatIssueLabelColor(label.color),
                                                                        }}
                                                                    >
                                                                        {label.name}
                                                                    </span>
                                                                )}
                                                            </For>
                                                        </Show>
                                                    </div>
                                                </button>
                                            </div>
                                        </div>

                                        <div class="flex items-center gap-2 flex-shrink-0">
                                            <button
                                                class="btn bg-panel hover:bg-panel-hover border border-color text-red flex items-center gap-2"
                                                onClick={() => void toggleState()}
                                                disabled={isSaving()}
                                            >
                                                <X size={14} />
                                                {currentIssue().state === "open" ? "Close issue" : "Reopen issue"}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div class="divider border-b border-color mb-8"></div>

                                <div class="issue-timeline flex flex-col gap-6">
                                    <div class="comment-card border border-color rounded-lg bg-panel overflow-hidden shadow-sm">
                                        <div class="comment-header px-4 py-2.5 bg-panel-hover border-b border-color">
                                            <strong class="text-primary">{currentIssue().author.login}</strong>
                                        </div>
                                        <div class="comment-body p-4 text-[15px] leading-relaxed text-primary whitespace-pre-wrap">
                                            {currentIssue().body || "No description provided."}
                                        </div>
                                    </div>

                                    <For each={comments()}>
                                        {(comment) => (
                                            <div class="comment-card border border-color rounded-lg bg-panel overflow-hidden shadow-sm">
                                                <div class="comment-header flex items-center justify-between px-4 py-2.5 bg-panel-hover border-b border-color">
                                                    <div class="flex items-center gap-2 text-sm">
                                                        <strong class="text-primary">{comment.commenter}</strong>
                                                        <span class="text-muted">commented {relativeTime(comment.created_at)}</span>
                                                    </div>
                                                </div>
                                                <div class="comment-body p-4 text-[15px] leading-relaxed text-primary whitespace-pre-wrap">
                                                    {comment.body}
                                                </div>
                                            </div>
                                        )}
                                    </For>

                                    <div class="composer-card border border-color rounded-lg bg-panel overflow-hidden focus-within:border-blue transition-colors shadow-sm">
                                        <textarea
                                            ref={commentInputRef}
                                            class="w-full bg-transparent border-none p-4 text-[15px] resize-y min-h-[120px] focus:outline-none text-primary"
                                            placeholder="Add a comment..."
                                            value={commentText()}
                                            onInput={(event) => setCommentText(event.currentTarget.value)}
                                        ></textarea>
                                        <div class="composer-footer flex items-center justify-between px-4 py-3 border-t border-light bg-app">
                                            <button
                                                class="hover:text-purple transition-colors text-purple flex items-center gap-1 bg-purple/10 px-2 py-1 rounded"
                                                onClick={toggleAgentDock}
                                            >
                                                Ask Agent
                                            </button>
                                            <button
                                                class="btn btn-primary flex items-center gap-2"
                                                disabled={!commentText().trim() || isSaving()}
                                                onClick={() => void submitComment()}
                                            >
                                                <MessageSquare size={14} />
                                                Comment
                                                <ShortcutBadge shortcutId="issue.comment" />
                                            </button>
                                        </div>
                                    </div>

                                    <Show when={activeEditor()}>
                                        {(editor) => (
                                            <div class="issue-editor-overlay" onClick={closeEditor}>
                                                <div class="issue-editor-modal" onClick={(event) => event.stopPropagation()}>
                                                    <div class="issue-editor-header">
                                                        <div>
                                                            <p class="issue-editor-eyebrow">Keyboard Action</p>
                                                            <h2>{editor() === "assignees" ? "Edit assignees" : "Edit labels"}</h2>
                                                        </div>
                                                        <button type="button" class="btn" onClick={closeEditor}>Close</button>
                                                    </div>

                                                    <Show when={editorErrorMessage()}>
                                                        <p class="text-red issue-editor-error">{editorErrorMessage()}</p>
                                                    </Show>

                                                    <Show when={editor() === "assignees"}>
                                                        <div class="issue-editor-body">
                                                            <input
                                                                ref={editorSearchRef}
                                                                type="search"
                                                                class="issue-editor-search"
                                                                placeholder="Search users"
                                                                value={editorSearch()}
                                                                onInput={(event) => {
                                                                    const value = event.currentTarget.value;
                                                                    setEditorSearch(value);
                                                                    void searchUsers(value).catch((error) => {
                                                                        setEditorErrorMessage(error instanceof Error ? error.message : "Failed to search users");
                                                                    });
                                                                }}
                                                            />

                                                            <Show when={draftAssignees().length > 0}>
                                                                <div class="issue-editor-chips">
                                                                    <For each={draftAssignees()}>
                                                                        {(assignee) => (
                                                                            <button type="button" class="issue-editor-chip" onClick={() => toggleAssignee(assignee)}>
                                                                                @{assignee}
                                                                            </button>
                                                                        )}
                                                                    </For>
                                                                </div>
                                                            </Show>

                                                            <div class="issue-editor-list">
                                                                <Show when={availableAssignees().length > 0} fallback={<p class="issue-editor-empty">Type to find assignees.</p>}>
                                                                    <For each={availableAssignees()}>
                                                                        {(user) => (
                                                                            <button
                                                                                type="button"
                                                                                class={`issue-editor-option ${draftAssignees().includes(user.username) ? "selected" : ""}`}
                                                                                onClick={() => toggleAssignee(user.username)}
                                                                            >
                                                                                <div>
                                                                                    <strong>{user.username}</strong>
                                                                                    <Show when={user.display_name && user.display_name !== user.username}>
                                                                                        <span>{user.display_name}</span>
                                                                                    </Show>
                                                                                </div>
                                                                                <span>{draftAssignees().includes(user.username) ? "Selected" : "Add"}</span>
                                                                            </button>
                                                                        )}
                                                                    </For>
                                                                </Show>
                                                            </div>
                                                        </div>
                                                    </Show>

                                                    <Show when={editor() === "labels"}>
                                                        <div class="issue-editor-body">
                                                            <input
                                                                ref={editorSearchRef}
                                                                type="search"
                                                                class="issue-editor-search"
                                                                placeholder="Filter labels"
                                                                value={editorSearch()}
                                                                onInput={(event) => setEditorSearch(event.currentTarget.value)}
                                                            />

                                                            <div class="issue-editor-list">
                                                                <Show when={!isEditorLoading() && filteredLabels().length > 0} fallback={<p class="issue-editor-empty">No labels match this search.</p>}>
                                                                    <For each={filteredLabels()}>
                                                                        {(label) => (
                                                                            <button
                                                                                type="button"
                                                                                class={`issue-editor-option ${draftLabels().includes(label.name) ? "selected" : ""}`}
                                                                                onClick={() => toggleLabel(label.name)}
                                                                            >
                                                                                <div>
                                                                                    <strong>{label.name}</strong>
                                                                                    <Show when={label.description}>
                                                                                        <span>{label.description}</span>
                                                                                    </Show>
                                                                                </div>
                                                                                <span>{draftLabels().includes(label.name) ? "Selected" : "Add"}</span>
                                                                            </button>
                                                                        )}
                                                                    </For>
                                                                </Show>
                                                            </div>
                                                        </div>
                                                    </Show>

                                                    <div class="issue-editor-footer">
                                                        <button type="button" class="btn" onClick={closeEditor}>Cancel</button>
                                                        <button type="button" class="btn btn-primary" disabled={isSaving()} onClick={() => void saveEditorChanges()}>
                                                            Save
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </Show>
                                </div>
                            </>
                        )}
                    </Show>
                </div>
            </div>
        </div>
    );
}
