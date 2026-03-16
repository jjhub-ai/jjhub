import { For, Show } from "solid-js";
import { Settings, User, Key, Shield, Link2, BookOpen } from "lucide-solid";
import { useAuth } from "../../layouts/AppLayout";

export default function SettingsView() {
    const { user, isLoading } = useAuth();

    const sections = [
        {
            title: "Identity",
            links: [
                { href: "/settings/emails", label: "Emails", description: "Add, verify, and remove account email addresses.", icon: User },
                { href: "/settings/accounts", label: "Connected Accounts", description: "Link GitHub and review supported sign-in methods.", icon: Link2 },
                { href: "/settings/applications", label: "OAuth Applications", description: "Open the developer application surface and current API status.", icon: Shield },
                { href: "/settings/notifications", label: "Notification Preferences", description: "Manage repository watch modes for email-triggering activity.", icon: BookOpen },
            ],
        },
        {
            title: "Credentials",
            links: [
                { href: "/settings/keys", label: "SSH Keys", description: "Manage the SSH keys attached to your account.", icon: Key },
                { href: "/settings/tokens", label: "API Tokens", description: "Create and revoke personal access tokens.", icon: Key },
                { href: "/settings/secrets", label: "Secrets", description: "Maintain repository secrets used by jobs and automations.", icon: Shield },
                { href: "/settings/variables", label: "Variables", description: "Maintain repository variables for shared configuration.", icon: Settings },
            ],
        },
        {
            title: "Platform",
            links: [
                { href: "/admin", label: "Admin Console", description: "Browse admin users, repos, orgs, runners, and system health.", icon: Shield },
                { href: "/settings/alpha", label: "Closed Alpha Access", description: "Review the waitlist and whitelist entries.", icon: Shield },
            ],
        },
    ] as const;

    return (
        <div class="w-full max-w-6xl mx-auto p-6 text-primary">
            <div class="flex items-center gap-2 text-xl font-semibold">
                <Settings size={20} class="text-secondary" />
                <h1>User Settings</h1>
            </div>
            <p class="text-sm text-muted mt-1">
                Account identity, connected services, repository notification settings, and platform access.
            </p>

            <div class="mt-6 rounded-xl border border-color bg-panel p-5">
                <div class="flex items-start gap-3">
                    <div class="flex h-11 w-11 items-center justify-center rounded-full bg-app border border-color">
                        <User size={18} class="text-secondary" />
                    </div>
                    <div class="min-w-0">
                        <h2 class="text-lg font-semibold">
                            <Show when={!isLoading()} fallback={"Loading account..."}>
                                {user()?.display_name || user()?.username || "Your account"}
                            </Show>
                        </h2>
                        <p class="text-sm text-muted">
                            <Show when={user()?.username}>
                                @{user()?.username}
                            </Show>
                            <Show when={user()?.email}>
                                <span class="ml-2">{user()?.email}</span>
                            </Show>
                        </p>
                    </div>
                </div>
            </div>

            <div class="mt-6 grid gap-6">
                <For each={sections}>
                    {(section) => (
                        <section class="rounded-xl border border-color bg-panel p-5">
                            <h2 class="text-lg font-semibold">{section.title}</h2>
                            <div class="mt-4 grid gap-3 md:grid-cols-2">
                                <For each={section.links}>
                                    {(link) => {
                                        const Icon = link.icon;
                                        return (
                                            <a
                                                href={link.href}
                                                class="rounded-lg border border-color bg-app p-4 transition-colors hover:border-light hover:bg-root"
                                                style={{ "text-decoration": "none", color: "inherit" }}
                                            >
                                                <div class="flex items-center gap-3">
                                                    <div class="flex h-9 w-9 items-center justify-center rounded-md border border-color bg-panel">
                                                        <Icon size={16} class="text-secondary" />
                                                    </div>
                                                    <div>
                                                        <div class="font-medium">{link.label}</div>
                                                        <p class="mt-1 text-sm text-muted">{link.description}</p>
                                                    </div>
                                                </div>
                                            </a>
                                        );
                                    }}
                                </For>
                            </div>
                        </section>
                    )}
                </For>
            </div>
        </div>
    );
}
