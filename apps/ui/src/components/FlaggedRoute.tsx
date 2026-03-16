import { Show, JSX } from 'solid-js';
import { useStore } from '@nanostores/solid';
import { featureFlags, type FeatureFlags } from '../lib/featureFlags';
import { Lock } from 'lucide-solid';

interface FlaggedRouteProps {
    flag: keyof FeatureFlags;
    children: JSX.Element;
}

/**
 * Wraps a route component behind a feature flag check.
 * If the flag is disabled, renders a "Feature not available" placeholder instead of the actual page.
 * This prevents users from accessing mock/placeholder pages via direct URL navigation
 * even when the sidebar link is hidden.
 */
export default function FlaggedRoute(props: FlaggedRouteProps) {
    const $flags = useStore(featureFlags);

    return (
        <Show
            when={$flags()[props.flag]}
            fallback={
                <div class="flex flex-col items-center justify-center h-full w-full bg-app text-primary p-8 text-center">
                    <div class="w-16 h-16 rounded-2xl bg-panel border border-color flex items-center justify-center mb-6">
                        <Lock size={32} class="text-muted" />
                    </div>
                    <h1 class="text-2xl font-semibold mb-3">Feature Not Available</h1>
                    <p class="text-muted max-w-md mx-auto mb-6">
                        This feature is not yet enabled. Check back soon for updates.
                    </p>
                    <a href="/" class="btn btn-primary">
                        Back to Repositories
                    </a>
                </div>
            }
        >
            {props.children}
        </Show>
    );
}
