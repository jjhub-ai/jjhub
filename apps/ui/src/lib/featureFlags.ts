import { atom } from 'nanostores';

/**
 * All supported feature flags. Keys must match the server-side flag names.
 */
export type FeatureFlags = {
    readout_dashboard: boolean;
    landing_queue: boolean;
    tool_skills: boolean;
    tool_policies: boolean;
    repo_snapshots: boolean;
    integrations: boolean;
    session_replay: boolean;
    secrets_manager: boolean;
    web_editor: boolean;
    client_error_reporting: boolean;
    client_metrics: boolean;
};

/**
 * Safe defaults: all features OFF except observability flags.
 * These are used until the server responds (or if the fetch fails).
 */
const DEFAULT_FLAGS: FeatureFlags = {
    readout_dashboard: false,
    landing_queue: false,
    tool_skills: false,
    tool_policies: false,
    repo_snapshots: false,
    integrations: false,
    session_replay: false,
    secrets_manager: false,
    web_editor: false,
    client_error_reporting: true,
    client_metrics: true,
};

/** Reactive store for feature flags. */
export const featureFlags = atom<FeatureFlags>({ ...DEFAULT_FLAGS });

/** Whether flags have been fetched from the server at least once. */
export const featureFlagsLoaded = atom(false);

/**
 * Fetch feature flags from the API and update the reactive store.
 * Safe to call multiple times; silently swallows errors and keeps defaults.
 */
export async function initFeatureFlags(): Promise<void> {
    try {
        const res = await fetch('/api/feature-flags');
        if (res.ok) {
            const data: { flags: Record<string, boolean> } = await res.json();
            if (data.flags && typeof data.flags === 'object') {
                const current = { ...DEFAULT_FLAGS };
                for (const key of Object.keys(DEFAULT_FLAGS) as (keyof FeatureFlags)[]) {
                    if (typeof data.flags[key] === 'boolean') {
                        current[key] = data.flags[key];
                    }
                }
                featureFlags.set(current);
            }
        }
    } catch {
        // Keep defaults on network failure
    } finally {
        featureFlagsLoaded.set(true);
    }
}

/**
 * Check if a specific feature flag is enabled.
 * Returns the flag value from the store, or the safe default if the flag is unknown.
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
    return featureFlags.get()[flag];
}
