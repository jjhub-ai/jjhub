import { createSignal } from "solid-js";
import { Mail, CheckCircle2, AlertCircle, ArrowRight } from "lucide-solid";

interface WaitlistFormProps {
    source?: string;
}

export default function WaitlistForm(props: WaitlistFormProps) {
    const [email, setEmail] = createSignal("");
    const [note, setNote] = createSignal("");
    const [submitting, setSubmitting] = createSignal(false);
    const [status, setStatus] = createSignal<string | null>(null);
    const [error, setError] = createSignal<string | null>(null);

    const submit = async () => {
        if (!email().trim()) {
            setError("Email is required.");
            return;
        }
        setSubmitting(true);
        setError(null);
        setStatus(null);
        try {
            const response = await fetch("/api/alpha/waitlist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: email().trim(),
                    note: note().trim(),
                    source: props.source ?? "ui",
                }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.message ?? `Failed to join waitlist (${response.status})`);
            }

            // Optional: You could conditionally redirect based on props.source if you want.
            // For now, always redirect.
            window.location.href = "/thank-you";
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to join waitlist";
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    // If we have an inline status (e.g., if redirect fails or we prefer inline success)
    if (status()) {
        return (
            <div class="waitlist-card success-card animate-fade-in">
                <CheckCircle2 size={32} class="text-green mx-auto mb-4" />
                <h3 class="text-xl font-bold text-center mb-2">Request Received</h3>
                <p class="text-muted text-center mb-0">{status()}</p>
            </div>
        );
    }

    return (
        <div class="waitlist-card group">
            <div class="waitlist-header mb-4">
                <Mail size={20} class="text-primary" />
                <h3 class="text-lg font-semibold">Join the waitlist</h3>
            </div>

            <form
                class="waitlist-form"
                onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                }}
            >
                <div class="input-group">
                    <label class="sr-only" for={`waitlist-email-${props.source ?? "ui"}`}>Email address</label>
                    <input
                        id={`waitlist-email-${props.source ?? "ui"}`}
                        name="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email()}
                        onInput={(e) => setEmail(e.currentTarget.value)}
                        autocomplete="email"
                        disabled={submitting()}
                    />
                </div>

                <div class="input-group">
                    <label class="sr-only" for={`waitlist-note-${props.source ?? "ui"}`}>Tell us about your team</label>
                    <textarea
                        id={`waitlist-note-${props.source ?? "ui"}`}
                        name="note"
                        placeholder="Tell us about your team (optional)"
                        value={note()}
                        onInput={(e) => setNote(e.currentTarget.value)}
                        disabled={submitting()}
                        rows={2}
                    />
                </div>

                <button
                    class="btn-primary waitlist-submit w-full flex items-center justify-center gap-2"
                    disabled={submitting()}
                    type="submit"
                >
                    {submitting() ? "Joining..." : "Request Access"}
                    {!submitting() && <ArrowRight size={16} />}
                </button>
            </form>

            {error() && (
                <div class="waitlist-error animate-fade-in mt-4 flex items-center gap-2" role="alert">
                    <AlertCircle size={14} />
                    <p>{error()}</p>
                </div>
            )}
        </div>
    );
}
