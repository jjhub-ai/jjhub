import { createSignal, Show } from "solid-js";
import { MessageSquare, CheckCircle2, AlertCircle, X, LoaderCircle } from "lucide-solid";
import { repoApiFetch } from "../../lib/repoContext";

interface ReviewFormProps {
    landingId: string;
    context: { owner: string; repo: string };
    onSubmitted: () => void;
    onClose: () => void;
}

export default function ReviewForm(props: ReviewFormProps) {
    const [body, setBody] = createSignal("");
    const [type, setType] = createSignal<"approve" | "comment" | "request_changes">("comment");
    const [isSubmitting, setIsSubmitting] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);

    const getCookieValue = (name: string): string | null => {
        if (typeof document === "undefined") return null;
        const prefix = `${name}=`;
        for (const raw of document.cookie.split(";")) {
            const part = raw.trim();
            if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length));
        }
        return null;
    };

    const submitReview = async () => {
        if ((type() === "comment" || type() === "request_changes") && !body().trim()) {
            setError("Body is required for comments and requested changes");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            const csrf = getCookieValue("__csrf");
            if (csrf) {
                headers["X-CSRF-Token"] = csrf;
            }

            const response = await repoApiFetch(`/landings/${props.landingId}/reviews`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    type: type(),
                    body: body(),
                }),
            }, props.context);

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || `Failed to submit review (${response.status})`);
            }

            props.onSubmitted();
            props.onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to submit review");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div class="review-form-dropdown animate-in fade-in zoom-in-95">
            <div class="p-4 border-b border-border flex justify-between items-center">
                <h3 class="font-semibold text-sm">Submit Review</h3>
                <button class="text-muted hover:text-primary" onClick={props.onClose}>
                    <X size={16} />
                </button>
            </div>
            
            <div class="p-4 flex flex-col gap-4">
                <textarea
                    class="w-full bg-app border border-border rounded-md p-3 text-sm min-h-[120px] focus:outline-none focus:border-blue transition-colors"
                    placeholder="Leave a comment..."
                    value={body()}
                    onInput={(e) => setBody(e.currentTarget.value)}
                ></textarea>

                <div class="review-type-selector">
                    <label class={`type-option ${type() === 'comment' ? 'selected' : ''}`}>
                        <input type="radio" name="review-type" value="comment" checked={type() === 'comment'} onChange={() => setType('comment')} />
                        <MessageSquare size={14} />
                        <div class="type-info">
                            <span class="type-label">Comment</span>
                            <span class="type-desc">General feedback</span>
                        </div>
                    </label>

                    <label class={`type-option ${type() === 'approve' ? 'selected' : ''}`}>
                        <input type="radio" name="review-type" value="approve" checked={type() === 'approve'} onChange={() => setType('approve')} />
                        <CheckCircle2 size={14} class="text-green" />
                        <div class="type-info">
                            <span class="type-label">Approve</span>
                            <span class="type-desc">Submit feedback and approve</span>
                        </div>
                    </label>

                    <label class={`type-option ${type() === 'request_changes' ? 'selected' : ''}`}>
                        <input type="radio" name="review-type" value="request_changes" checked={type() === 'request_changes'} onChange={() => setType('request_changes')} />
                        <AlertCircle size={14} class="text-red" />
                        <div class="type-info">
                            <span class="type-label">Request Changes</span>
                            <span class="type-desc">Submit feedback that must be addressed</span>
                        </div>
                    </label>
                </div>

                <Show when={error()}>
                    <p class="text-red text-xs">{error()}</p>
                </Show>

                <button 
                    class="primary-btn w-full py-2 flex items-center justify-center gap-2" 
                    disabled={isSubmitting()} 
                    onClick={() => void submitReview()}
                >
                    <Show when={isSubmitting()} fallback="Submit Review">
                        <LoaderCircle size={14} class="animate-spin" />
                        Submitting...
                    </Show>
                </button>
            </div>
        </div>
    );
}
