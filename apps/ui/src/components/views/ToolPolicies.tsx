import { Shield } from 'lucide-solid';

export default function ToolPolicies() {
    return (
        <div class="flex flex-col items-center justify-center h-full w-full bg-app text-primary p-8 text-center">
            <div class="w-16 h-16 rounded-2xl bg-panel border border-color flex items-center justify-center mb-6">
                <Shield size={32} class="text-yellow" />
            </div>
            <h1 class="text-2xl font-semibold mb-3">Agent Policies</h1>
            <p class="text-muted max-w-md mx-auto">
                Guardrails for AI agent logic. Security and workflow policies will be configurable here once connected to the backend.
            </p>
        </div>
    );
}
