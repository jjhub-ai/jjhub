/**
 * Feature flags store.
 * Fetches flags from the API and exposes them as a reactive nanostore.
 */

import { atom } from "nanostores";
import type { FeatureFlags } from "../api/types";
import { apiFetch } from "../api/client";

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

export const featureFlags = atom<FeatureFlags>({ ...DEFAULT_FLAGS });
export const featureFlagsLoaded = atom(false);

export async function initFeatureFlags(): Promise<void> {
    try {
        const res = await apiFetch("/api/feature-flags");
        if (res.ok) {
            const data: { flags: Record<string, boolean> } = await res.json();
            if (data.flags && typeof data.flags === "object") {
                const current = { ...DEFAULT_FLAGS };
                for (const key of Object.keys(DEFAULT_FLAGS) as (keyof FeatureFlags)[]) {
                    if (typeof data.flags[key] === "boolean") {
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

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
    return featureFlags.get()[flag];
}
