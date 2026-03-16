import { Activity } from 'lucide-solid';

export default function LandingQueue() {
    return (
        <div class="flex flex-col items-center justify-center h-full w-full bg-app text-primary p-8 text-center">
            <div class="w-16 h-16 rounded-2xl bg-panel border border-color flex items-center justify-center mb-6">
                <Activity size={32} class="text-green" />
            </div>
            <h1 class="text-2xl font-semibold mb-3">Global Landing Queue</h1>
            <p class="text-muted max-w-md mx-auto">
                The landing queue shows in-progress merges and CI checks. This feature is coming soon.
            </p>
        </div>
    );
}
