import { Bot } from 'lucide-solid';

export default function RepoSnapshots() {
    return (
        <div class="flex flex-col items-center justify-center h-full w-full bg-app text-primary p-8 text-center">
            <div class="w-16 h-16 rounded-2xl bg-panel border border-color flex items-center justify-center mb-6">
                <Bot size={32} class="text-blue" />
            </div>
            <h1 class="text-2xl font-semibold mb-3">AI Snapshots</h1>
            <p class="text-muted max-w-md mx-auto">
                A history of generated code blocks from your agent sessions. This feature is coming soon.
            </p>
        </div>
    );
}
