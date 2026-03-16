import { BarChart2 } from 'lucide-solid';

export default function ReadoutDashboard() {
    return (
        <div class="flex flex-col items-center justify-center h-full w-full bg-app text-primary p-8 text-center">
            <div class="w-16 h-16 rounded-2xl bg-panel border border-color flex items-center justify-center mb-6">
                <BarChart2 size={32} class="text-blue" />
            </div>
            <h1 class="text-2xl font-semibold mb-3">Readout Dashboard</h1>
            <p class="text-muted max-w-md mx-auto">
                Usage analytics, cost breakdowns, and activity metrics will appear here once connected to the backend.
            </p>
        </div>
    );
}
