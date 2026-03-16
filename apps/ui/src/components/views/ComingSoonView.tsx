type ComingSoonViewProps = {
    title: string;
    description?: string;
};

export default function ComingSoonView(props: ComingSoonViewProps) {
    return (
        <div class="flex min-h-full items-center justify-center bg-app p-8 text-primary">
            <div class="max-w-xl rounded-2xl border border-color bg-panel p-8 text-center shadow-lg">
                <p class="text-xs font-semibold uppercase tracking-[0.22em] text-muted">JJHub UI</p>
                <h1 class="mt-3 text-3xl font-semibold">{props.title}</h1>
                <p class="mt-3 text-sm text-muted">{props.description ?? 'Coming soon.'}</p>
            </div>
        </div>
    );
}
