import { createSignal, onMount, Show } from "solid-js";
import { BellRing, Save } from "lucide-solid";
import { withAuthHeaders } from "../../lib/repoContext";
import "./FeatureSurface.css";
import { readErrorMessage } from "./viewSupport";

type NotificationPreferences = {
    email_notifications_enabled: boolean;
};

export default function NotificationPreferencesView() {
    const [emailNotificationsEnabled, setEmailNotificationsEnabled] = createSignal(false);
    const [isLoading, setIsLoading] = createSignal(true);
    const [isSaving, setIsSaving] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
    const [notice, setNotice] = createSignal<string | null>(null);

    const loadPreferences = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const response = await fetch("/api/user/settings/notifications", {
                credentials: "include",
                headers: withAuthHeaders(),
            });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, "Failed to load notification preferences"));
            }
            const payload = (await response.json()) as NotificationPreferences;
            setEmailNotificationsEnabled(Boolean(payload.email_notifications_enabled));
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to load notification preferences");
        } finally {
            setIsLoading(false);
        }
    };

    onMount(() => {
        void loadPreferences();
    });

    const savePreferences = async (event: Event) => {
        event.preventDefault();
        setIsSaving(true);
        setErrorMessage(null);
        setNotice(null);
        try {
            const response = await fetch("/api/user/settings/notifications", {
                method: "PUT",
                credentials: "include",
                headers: withAuthHeaders({
                    "Content-Type": "application/json",
                }),
                body: JSON.stringify({
                    email_notifications_enabled: emailNotificationsEnabled(),
                }),
            });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, "Failed to save notification preferences"));
            }
            setNotice("Notification preferences updated.");
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to save notification preferences");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div class="surface-page">
            <header class="surface-header">
                <div>
                    <h1>Notification Preferences</h1>
                    <p>Control whether JJHub sends activity updates to the verified email addresses on your account.</p>
                </div>
            </header>

            <Show when={errorMessage()}>
                {(message) => <div class="surface-banner error">{message()}</div>}
            </Show>
            <Show when={notice()}>
                {(message) => <div class="surface-banner success">{message()}</div>}
            </Show>

            <Show when={isLoading()}>
                <div class="surface-empty">
                    <h3>Loading notification preferences...</h3>
                </div>
            </Show>

            <Show when={!isLoading()}>
                <form class="surface-card surface-form" onSubmit={savePreferences}>
                    <div class="surface-card-header">
                        <div>
                            <h2>Email delivery</h2>
                            <p>This currently controls all account-level email notifications.</p>
                        </div>
                        <BellRing size={20} class="text-muted" />
                    </div>

                    <label class="surface-checkbox">
                        <input
                            type="checkbox"
                            checked={emailNotificationsEnabled()}
                            onChange={(event) => setEmailNotificationsEnabled(event.currentTarget.checked)}
                        />
                        <div>
                            <strong>Enable email notifications</strong>
                            <p>Receive JJHub emails for mentions, verification flows, and repository events.</p>
                        </div>
                    </label>

                    <div class="surface-form-actions">
                        <button type="submit" class="primary-btn" disabled={isSaving()}>
                            <Save size={16} />
                            {isSaving() ? "Saving..." : "Save Preferences"}
                        </button>
                    </div>
                </form>
            </Show>
        </div>
    );
}
