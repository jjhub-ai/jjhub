import { createEffect, createSignal, For, onMount, Show } from "solid-js";
import { useParams } from "@solidjs/router";
import { useStore } from "@nanostores/solid";
import {
    CheckCircle2,
    ChevronDown,
    Edit3,
    FileCode,
    GitCommit,
    GitMerge,
    LoaderCircle,
    MessageSquare,
    XCircle,
} from "lucide-solid";
import { isCommandPaletteOpen, isKeyboardHelpOpen } from "../../stores/workbench";
import { repoApiFetch } from "../../lib/repoContext";
import { useKeyboardActionTarget, useSingleKeyShortcuts } from "../../lib/keyboard";
import {
    landingDetailResource,
    landingDiffResource,
    type LandingChange,
    type LandingComment,
    type LandingDetail,
    type LandingDiffResponse,
    type LandingReview,
} from "../../lib/navigationData";
import { setCachedValue } from "../../lib/prefetchCache";
import { $diffWhitespaceMode } from "../../stores/diff-preferences";
import ShortcutBadge from "../keyboard/ShortcutBadge";
import DiffViewer, { type RenderableDiffFile } from "./DiffViewer";
import ReviewForm from "./ReviewForm";
import "./LandingRequest.css";

function getCookieValue(name: string): string | null {
    if (typeof document === "undefined") {
        return null;
    }
    const prefix = `${name}=`;
    for (const raw of document.cookie.split(";")) {
        const part = raw.trim();
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

export default function LandingRequest() {
    const params = useParams<{ owner: string; repo: string; id: string }>();
    const props = { get id() { return params.id; } };
    const $isCommandPaletteOpen = useStore(isCommandPaletteOpen);
    const $isKeyboardHelpOpen = useStore(isKeyboardHelpOpen);
    const context = () => ({ owner: params.owner ?? "", repo: params.repo ?? "" });

    const [activeTab, setActiveTab] = createSignal<"overview" | "commits" | "files">("overview");
    const whitespaceMode = useStore($diffWhitespaceMode);
    const initialBundle = landingDetailResource.peek(context(), props.id);
    const initialDiff = landingDiffResource.peek(context(), props.id, whitespaceMode() === "ignore" ? "ignore" : "show");
    const [landing, setLanding] = createSignal<LandingDetail | null>(initialBundle?.landing ?? null);
    const [comments, setComments] = createSignal<LandingComment[]>(initialBundle?.comments ?? []);
    const [reviews, setReviews] = createSignal<LandingReview[]>(initialBundle?.reviews ?? []);
    const [changes, setChanges] = createSignal<LandingChange[]>(initialBundle?.changes ?? []);
    const [diff, setDiff] = createSignal<LandingDiffResponse | null>(initialDiff ?? null);
    const [isLoading, setIsLoading] = createSignal(initialBundle === undefined);
    const [isDiffLoading, setIsDiffLoading] = createSignal(initialDiff === undefined);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [diffErrorMessage, setDiffErrorMessage] = createSignal<string | null>(null);
    const [isLanding, setIsLanding] = createSignal(false);
    const [landMessage, setLandMessage] = createSignal<string | null>(null);
    const [showReviewForm, setShowReviewForm] = createSignal(false);
    const [commentText, setCommentText] = createSignal("");
    const [isSubmittingComment, setIsSubmittingComment] = createSignal(false);
    let commentInputRef: HTMLTextAreaElement | undefined;
    const keyboardActionsEnabled = () => !$isCommandPaletteOpen() && !$isKeyboardHelpOpen() && !showReviewForm();

    const syncLandingDetailCache = (overrides: {
        landing?: LandingDetail | null;
        comments?: LandingComment[];
        reviews?: LandingReview[];
        changes?: LandingChange[];
    } = {}) => {
        const nextLanding = overrides.landing ?? landing();
        if (!nextLanding) {
            return;
        }

        setCachedValue(landingDetailResource.key(context(), props.id), {
            landing: nextLanding,
            comments: overrides.comments ?? comments(),
            reviews: overrides.reviews ?? reviews(),
            changes: overrides.changes ?? changes(),
        });
    };

    const loadData = async (options: { refresh?: boolean } = {}) => {
        const cachedBundle = options.refresh ? undefined : landingDetailResource.peek(context(), props.id);
        if (cachedBundle) {
            setLanding(cachedBundle.landing);
            setComments(cachedBundle.comments);
            setReviews(cachedBundle.reviews);
            setChanges(cachedBundle.changes);
        }

        setIsLoading(!cachedBundle && !options.refresh);
        setErrorMessage(null);

        try {
            const bundle = options.refresh
                ? await landingDetailResource.reload(context(), props.id)
                : await landingDetailResource.load(context(), props.id);
            setLanding(bundle.landing);
            setComments(bundle.comments);
            setReviews(bundle.reviews);
            setChanges(bundle.changes);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load landing request";
            setErrorMessage(message);
        } finally {
            setIsLoading(false);
        }
    };

    const loadDiff = async () => {
        const mode = whitespaceMode() === "ignore" ? "ignore" : "show";
        const cachedDiff = landingDiffResource.peek(context(), props.id, mode);
        if (cachedDiff) {
            setDiff(cachedDiff);
        }

        setIsDiffLoading(!cachedDiff);
        setDiffErrorMessage(null);

        try {
            setDiff(await landingDiffResource.load(context(), props.id, mode));
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load landing diff";
            setDiffErrorMessage(message);
            setDiff(null);
        } finally {
            setIsDiffLoading(false);
        }
    };

    onMount(() => {
        void loadData();
    });

    createEffect(() => {
        whitespaceMode();
        void loadDiff();
    });

    const landChange = async () => {
        setIsLanding(true);
        setLandMessage(null);
        setErrorMessage(null);
        try {
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            const csrf = getCookieValue("__csrf");
            if (csrf) {
                headers["X-CSRF-Token"] = csrf;
            }

            const response = await repoApiFetch(`/landings/${props.id}/land`, {
                method: "PUT",
                headers,
                body: JSON.stringify({}),
            }, context());
            if (!response.ok) {
                throw new Error(`Failed to enqueue landing request (${response.status})`);
            }
            setLandMessage("Landing request queued.");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to land change";
            setErrorMessage(message);
        } finally {
            setIsLanding(false);
        }
    };

    const submitComment = async () => {
        const body = commentText().trim();
        if (!body) return;

        setIsSubmittingComment(true);
        setErrorMessage(null);

        try {
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            const csrf = getCookieValue("__csrf");
            if (csrf) {
                headers["X-CSRF-Token"] = csrf;
            }

            const response = await repoApiFetch(`/landings/${props.id}/comments`, {
                method: "POST",
                headers,
                body: JSON.stringify({ body, path: "", line: 0, side: "right" }),
            }, context());

            if (!response.ok) {
                throw new Error(`Failed to post comment (${response.status})`);
            }

            const created = (await response.json()) as LandingComment;
            const currentLanding = landing();
            const nextLanding = currentLanding
                ? {
                    ...currentLanding,
                    updated_at: created.updated_at || created.created_at,
                }
                : null;
            const nextComments = [...comments(), created];
            setLanding(nextLanding);
            setComments(nextComments);
            syncLandingDetailCache({
                landing: nextLanding,
                comments: nextComments,
            });
            setCommentText("");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to post comment";
            setErrorMessage(message);
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const dismissReview = async (reviewId: number) => {
        setErrorMessage(null);
        try {
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            const csrf = getCookieValue("__csrf");
            if (csrf) {
                headers["X-CSRF-Token"] = csrf;
            }

            const response = await repoApiFetch(`/landings/${props.id}/reviews/${reviewId}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ message: "Review dismissed by maintainer" }),
            }, context());

            if (!response.ok) {
                throw new Error(`Failed to dismiss review (${response.status})`);
            }

            await loadData({ refresh: true });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to dismiss review";
            setErrorMessage(message);
        }
    };

    const fileDiffs = (): RenderableDiffFile[] => {
        const current = diff();
        if (!current) {
            return [];
        }
        return current.changes.flatMap((change) =>
            change.file_diffs.map((file) => ({
                ...file,
                change_id: change.change_id,
                id: `${change.change_id}:${file.path}`,
            }))
        );
    };

    const focusCommentComposer = () => {
        if (activeTab() !== "overview") {
            setActiveTab("overview");
        }
        commentInputRef?.focus();
        commentInputRef?.scrollIntoView({ block: "center", behavior: "smooth" });
    };

    useSingleKeyShortcuts({
        bindings: () => [
            { key: "c", action: focusCommentComposer },
        ],
        enabled: keyboardActionsEnabled,
    });

    useKeyboardActionTarget({
        comment: focusCommentComposer,
    }, keyboardActionsEnabled);

    return (
        <div class="landing-container">
            <Show when={isLoading()}>
                <p class="text-muted">Loading landing request...</p>
            </Show>
            <Show when={errorMessage()}>
                <p class="text-red mb-4">{errorMessage()}</p>
            </Show>
            <Show when={landMessage()}>
                <p class="text-green mb-4">{landMessage()}</p>
            </Show>

            <Show when={landing()}>
                {(currentLanding) => (
                    <>
                        <header class="landing-header animate-in stagger-1">
                            <div class="landing-meta">
                                <span class="text-muted">{context().repo} /</span> LR-{currentLanding().number}
                            </div>
                            <div class="landing-title-row">
                                <h1 data-testid="landing-title">{currentLanding().title}</h1>
                                <div class="landing-actions relative">
                                    <button class="secondary-btn" onClick={() => setShowReviewForm(!showReviewForm())}>
                                        Review
                                    </button>
                                    <Show when={showReviewForm()}>
                                        <ReviewForm
                                            landingId={props.id}
                                            context={context()}
                                            onSubmitted={() => void loadData({ refresh: true })}
                                            onClose={() => setShowReviewForm(false)}
                                        />
                                    </Show>
                                    <button class="primary-btn landing-btn" disabled={isLanding()} onClick={() => void landChange()}>
                                        <Show when={isLanding()} fallback="Land Change">
                                            <span class="flex items-center gap-2">
                                                <LoaderCircle size={14} class="animate-spin" />
                                                Landing...
                                            </span>
                                        </Show>
                                    </button>
                                </div>
                            </div>

                            <div class="landing-status-row">
                                <div class="status-badge bg-green-subtle text-green">
                                    <GitMerge size={14} />
                                    {currentLanding().state === "open" ? "Ready to Land" : currentLanding().state}
                                </div>
                                <span class="text-muted text-sm ml-2">
                                    <strong class="text-primary">{currentLanding().author.login}</strong> wants to land{" "}
                                    {currentLanding().stack_size} change(s) into{" "}
                                    <strong class="text-primary font-mono bg-panel px-1 rounded">{currentLanding().target_bookmark}</strong>
                                </span>
                            </div>
                        </header>

                        <div class="landing-tabs animate-in stagger-2">
                            <button class={`tab ${activeTab() === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>
                                Overview
                            </button>
                            <button class={`tab ${activeTab() === "commits" ? "active" : ""}`} onClick={() => setActiveTab("commits")}>
                                Commits <span class="tab-count">{changes().length}</span>
                            </button>
                            <button class={`tab ${activeTab() === "files" ? "active" : ""}`} onClick={() => setActiveTab("files")}>
                                Files Changed <span class="tab-count">{fileDiffs().length}</span>
                            </button>
                        </div>

                        <div class="landing-content animate-in stagger-3">
                            <Show when={activeTab() === "overview"}>
                                <div class="overview-layout">
                                    <div class="main-column">
                                        <div class="description-box">
                                            <div class="box-header">
                                                <div class="author-avatar jjhub-gradient">{currentLanding().author.login.slice(0, 1).toUpperCase()}</div>
                                                <span class="font-semibold text-sm">{currentLanding().author.login}</span>
                                                <span class="text-muted text-xs ml-2">updated {relativeTime(currentLanding().updated_at)}</span>
                                            </div>
                                            <div class="box-body text-body whitespace-pre-wrap">
                                                {currentLanding().body || "No description provided."}
                                            </div>
                                        </div>

                                        <div class="timeline">
                                            <For each={reviews()}>
                                                {(review) => (
                                                    <div class={`timeline-item ${review.state === 'dismissed' ? 'review-dismissed' : ''}`}>
                                                        <div class={`timeline-icon ${review.type === 'approve' ? 'bg-green-subtle text-green border-green' : review.type === 'request_changes' ? 'bg-red-subtle text-red border-red' : ''}`}>
                                                            {review.type === 'approve' ? <CheckCircle2 size={14} /> : review.type === 'request_changes' ? <XCircle size={14} /> : <MessageSquare size={14} />}
                                                        </div>
                                                        <div class="timeline-content">
                                                            <div class="flex items-center justify-between">
                                                                <div>
                                                                    <span class="font-semibold">{review.reviewer.login}</span>{" "}
                                                                    <span class="text-muted">
                                                                        {review.type.replace('_', ' ')} · {relativeTime(review.created_at)}
                                                                        {review.state === 'dismissed' && " (dismissed)"}
                                                                    </span>
                                                                </div>
                                                                <Show when={review.state !== 'dismissed'}>
                                                                    <button 
                                                                        class="text-xs text-muted hover:text-red transition-colors"
                                                                        onClick={() => void dismissReview(review.id)}
                                                                    >
                                                                        Dismiss
                                                                    </button>
                                                                </Show>
                                                            </div>
                                                            <div class="comment-bubble mt-2 text-sm bg-panel p-3 rounded-lg border border-border">
                                                                {review.body}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </For>
                                            <For each={comments().filter(c => !c.path)}>
                                                {(comment) => (
                                                    <div class="timeline-item">
                                                        <div class="timeline-icon">
                                                            <Edit3 size={14} />
                                                        </div>
                                                        <div class="timeline-content">
                                                            <span class="font-semibold">{comment.author.login}</span>{" "}
                                                            <span class="text-muted">
                                                                commented · {relativeTime(comment.created_at)}
                                                            </span>
                                                            <div class="comment-bubble mt-2 text-sm bg-panel p-3 rounded-lg border border-border">
                                                                {comment.body}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </For>

                                            <div class="composer-card mt-8 border border-border rounded-lg bg-panel overflow-hidden focus-within:border-blue transition-colors shadow-sm">
                                                <textarea
                                                    ref={commentInputRef}
                                                    class="w-full bg-transparent border-none p-4 text-[15px] resize-y min-h-[120px] focus:outline-none text-primary"
                                                    placeholder="Add a comment..."
                                                    value={commentText()}
                                                    onInput={(event) => setCommentText(event.currentTarget.value)}
                                                ></textarea>
                                                <div class="composer-footer flex items-center justify-end px-4 py-3 border-t border-border bg-app">
                                                    <button
                                                        class="primary-btn flex items-center gap-2"
                                                        disabled={!commentText().trim() || isSubmittingComment()}
                                                        onClick={() => void submitComment()}
                                                    >
                                                        <Show when={isSubmittingComment()} fallback={<><MessageSquare size={14} /> Comment <ShortcutBadge shortcutId="landing.comment" /></>}>
                                                            <LoaderCircle size={14} class="animate-spin" />
                                                            Posting...
                                                        </Show>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="sidebar-column">
                                        <div class="sidebar-section">
                                            <h3 class="section-title">Checks</h3>
                                            <p class="text-muted text-xs mt-2">No checks configured.</p>
                                        </div>

                                        <div class="sidebar-section">
                                            <h3 class="section-title">Conflict Object</h3>
                                            <p class="text-muted text-xs mt-2">
                                                {currentLanding().conflict_status === "clean"
                                                    ? "No conflicts detected."
                                                    : `Conflict status: ${currentLanding().conflict_status}`}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </Show>

                            <Show when={activeTab() === "commits"}>
                                <div class="files-layout">
                                    <For each={changes()}>
                                        {(change) => (
                                            <div class="diff-file-card mb-4 border border-border rounded-lg bg-panel overflow-hidden">
                                                <div class="diff-file-header bg-app px-4 py-3 border-b border-border flex justify-between items-center text-sm">
                                                    <div class="flex items-center gap-2">
                                                        <GitCommit size={16} class="text-muted" />
                                                        <span class="font-mono">{change.change_id}</span>
                                                    </div>
                                                    <div class="diff-stats flex gap-3 text-xs">
                                                        <span class="text-muted">stack #{change.position_in_stack}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </Show>

                            <Show when={activeTab() === "files"}>
                                <div class="files-layout">
                                    <div class="diff-summary mb-6">
                                        <span class="text-sm font-semibold">Showing {fileDiffs().length} changed files</span>
                                    </div>
                                    <DiffViewer
                                        files={fileDiffs()}
                                        isLoading={isDiffLoading()}
                                        errorMessage={diffErrorMessage()}
                                        onRetry={() => void loadDiff()}
                                        emptyMessage="No files changed in this landing request."
                                        comments={comments().filter(c => c.path)}
                                        landingId={props.id}
                                        context={context()}
                                        onCommentSubmitted={() => void loadData({ refresh: true })}
                                    />
                                </div>
                            </Show>
                        </div>
                    </>
                )}
            </Show>
        </div>
    );
}
