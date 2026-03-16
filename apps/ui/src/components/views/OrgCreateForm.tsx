import { createSignal, onMount, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Building2, ShieldAlert, Globe, Lock } from "lucide-solid";
import { withAuthHeaders } from "../../lib/repoContext";

function validateOrgName(name: string): string | null {
    if (!name) return "Organization name is required.";
    if (!/^[a-zA-Z0-9]/.test(name)) return "Name must start with a letter or number.";
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) return "Name may only contain letters, numbers, hyphens, underscores, and dots.";
    if (name.length > 255) return "Name must be 255 characters or fewer.";
    return null;
}

export default function OrgCreateForm() {
    const navigate = useNavigate();
    const [isHydrated, setIsHydrated] = createSignal(false);
    const [isSubmitting, setIsSubmitting] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

    const [orgName, setOrgName] = createSignal("");
    const [nameError, setNameError] = createSignal<string | null>(null);
    const [description, setDescription] = createSignal("");
    const [visibility, setVisibility] = createSignal<"public" | "private">("public");

    const handleNameInput = (value: string) => {
        setOrgName(value);
        if (value.trim()) {
            setNameError(validateOrgName(value.trim()));
        } else {
            setNameError(null);
        }
    };

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        const trimmedName = orgName().trim();

        const validationError = validateOrgName(trimmedName);
        if (validationError) {
            setNameError(validationError);
            return;
        }

        setIsSubmitting(true);
        setErrorMessage(null);

        try {
            const res = await fetch("/api/orgs", {
                method: "POST",
                credentials: "include",
                headers: withAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({
                    name: trimmedName,
                    description: description().trim(),
                    visibility: visibility(),
                }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => null);
                const apiMessage = (body as { message?: string })?.message;
                throw new Error(apiMessage ?? `Failed to create organization (${res.status})`);
            }

            const created = (await res.json()) as { name?: string };
            const createdName = created.name ?? trimmedName;
            navigate(`/orgs/${encodeURIComponent(createdName)}/settings`);
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : "Failed to create organization");
        } finally {
            setIsSubmitting(false);
        }
    };

    onMount(() => setIsHydrated(true));

    return (
        <div class="org-settings-view bg-root text-primary min-h-full" data-hydrated={isHydrated() ? "true" : "false"}>
            <div class="max-w-2xl mx-auto w-full p-8 pb-32">
                <header class="flex items-center gap-4 mb-8 pb-6 border-b border-color animate-in stagger-1">
                    <div class="w-12 h-12 rounded-xl bg-purple/10 border border-purple/20 flex items-center justify-center text-purple">
                        <Building2 size={24} />
                    </div>
                    <div>
                        <h1 class="text-2xl font-semibold m-0">Create Organization</h1>
                        <p class="text-muted m-0 text-sm mt-1">Organizations let you manage repositories and team access.</p>
                    </div>
                </header>

                <Show when={errorMessage()}>
                    <div class="p-3 mb-6 bg-red/10 border border-red/20 text-red rounded-lg text-sm flex items-center gap-2 animate-in">
                        <ShieldAlert size={16} class="flex-shrink-0" />
                        {errorMessage()}
                    </div>
                </Show>

                <form class="bg-panel border border-color rounded-xl p-6 animate-in stagger-2" onSubmit={(e) => void handleSubmit(e)}>
                    <div class="mb-5">
                        <label class="block text-sm font-medium mb-1" for="org-name">Organization Name</label>
                        <input
                            type="text"
                            id="org-name"
                            placeholder="e.g. acme-corp"
                            value={orgName()}
                            onInput={(e) => handleNameInput(e.currentTarget.value)}
                            required
                            autofocus
                            class={`w-full bg-app border rounded-lg px-3 py-2 text-primary focus:border-blue transition-colors focus:outline-none ${nameError() ? "border-red" : "border-color"}`}
                            autocomplete="off"
                        />
                        <Show when={nameError()}>
                            <p class="text-xs text-red mt-1">{nameError()}</p>
                        </Show>
                        <Show when={!nameError()}>
                            <p class="text-xs text-muted mt-1">Lowercase letters, numbers, hyphens, underscores, and dots.</p>
                        </Show>
                    </div>

                    <div class="mb-5">
                        <label class="block text-sm font-medium mb-1" for="org-description">
                            Description <span class="text-muted font-normal text-xs ml-1">(Optional)</span>
                        </label>
                        <input
                            type="text"
                            id="org-description"
                            placeholder="What is this organization for?"
                            value={description()}
                            onInput={(e) => setDescription(e.currentTarget.value)}
                            class="w-full bg-app border border-color rounded-lg px-3 py-2 text-primary focus:border-blue transition-colors focus:outline-none"
                        />
                    </div>

                    <div class="mb-6">
                        <label class="block text-sm font-medium mb-2">Visibility</label>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label
                                class={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${visibility() === "public" ? "border-blue bg-blue/5" : "border-color hover:bg-panel-hover"}`}
                            >
                                <input
                                    type="radio"
                                    name="visibility"
                                    checked={visibility() === "public"}
                                    onChange={() => setVisibility("public")}
                                    class="sr-only"
                                />
                                <Globe size={18} class="text-green flex-shrink-0" />
                                <div>
                                    <div class="text-sm font-medium">Public</div>
                                    <div class="text-xs text-muted">Visible to everyone</div>
                                </div>
                            </label>
                            <label
                                class={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${visibility() === "private" ? "border-blue bg-blue/5" : "border-color hover:bg-panel-hover"}`}
                            >
                                <input
                                    type="radio"
                                    name="visibility"
                                    checked={visibility() === "private"}
                                    onChange={() => setVisibility("private")}
                                    class="sr-only"
                                />
                                <Lock size={18} class="text-red flex-shrink-0" />
                                <div>
                                    <div class="text-sm font-medium">Private</div>
                                    <div class="text-xs text-muted">Only members can see</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div class="pt-4 border-t border-color flex justify-end gap-3">
                        <button
                            type="button"
                            class="btn"
                            onClick={() => window.history.back()}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            class="btn btn-primary"
                            disabled={isSubmitting() || !!nameError()}
                        >
                            {isSubmitting() ? "Creating..." : "Create Organization"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
