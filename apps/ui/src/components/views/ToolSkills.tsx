import { Wrench } from 'lucide-solid';

export default function ToolSkills() {
    return (
        <div class="flex flex-col items-center justify-center h-full w-full bg-app text-primary p-8 text-center">
            <div class="w-16 h-16 rounded-2xl bg-panel border border-color flex items-center justify-center mb-6">
                <Wrench size={32} class="text-secondary" />
            </div>
            <h1 class="text-2xl font-semibold mb-3">Agent Skills</h1>
            <p class="text-muted max-w-md mx-auto">
                Reusable prompts and functions that extend your agent's capabilities. This feature is coming soon.
            </p>
        </div>
    );
}
