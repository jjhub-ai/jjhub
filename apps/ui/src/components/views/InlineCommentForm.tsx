import { createSignal, Show } from "solid-js";
import { MessageSquare, LoaderCircle } from "lucide-solid";
import { repoApiFetch } from "../../lib/repoContext";

interface InlineCommentFormProps {
    landingId: string;
    context: { owner: string; repo: string };
    path: string;
    line: number;
    side: "left" | "right";
    onSubmitted: () => void;
    onClose: () => void;
}

export default function InlineCommentForm(props: InlineCommentFormProps) {
    const [body, setBody] = createSignal("");
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

    const submitComment = async () => {
        if (!body().trim()) {
            setError("Comment cannot be empty");
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

            const response = await repoApiFetch(`/landings/${props.landingId}/comments`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    path: props.path,
                    line: props.line,
                    side: props.side,
                    body: body(),
                }),
            }, props.context);

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || `Failed to post comment (${response.status})`);
            }

            props.onSubmitted();
            props.onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to post comment");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div class="inline-comment-form p-3 bg-panel border border-border rounded-lg shadow-lg mt-2 mb-2 ml-4 mr-4 animate-in slide-in-from-top-2">
            <textarea
                class="w-full bg-app border border-border rounded-md p-2 text-sm min-h-[80px] focus:outline-none focus:border-blue transition-colors mb-2"
                placeholder="Write a comment..."
                value={body()}
                onInput={(e) => setBody(e.currentTarget.value)}
                autofocus
            ></textarea>

            <Show when={error()}>
                <p class="text-red text-xs mb-2">{error()}</p>
            </Show>

            <div class="flex justify-end gap-2">
                <button class="secondary-btn py-1 px-3 text-xs" onClick={props.onClose}>
                    Cancel
                </button>
                <button 
                    class="primary-btn py-1 px-3 text-xs flex items-center gap-1" 
                    disabled={isSubmitting() || !body().trim()} 
                    onClick={() => void submitComment()}
                >
                    <Show when={isSubmitting()} fallback={<><MessageSquare size={12} /> Comment</>}>
                        <LoaderCircle size={12} class="animate-spin" />
                        Posting...
                    </Show>
                </button>
            </div>
        </div>
    );
}
