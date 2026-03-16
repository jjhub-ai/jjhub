import * as Sentry from '@sentry/solid';
import { ErrorBoundary, type ParentProps } from 'solid-js';

const SentryErrorBoundary = Sentry.withSentryErrorBoundary(ErrorBoundary);

function CrashFallback(error: Error, reset: () => void) {
    return (
        <div class="login-container">
            <div class="glow-orb top-right"></div>
            <div class="glow-orb bottom-left"></div>
            <div class="login-content animate-in stagger-1" style={{ 'max-width': '560px', margin: '0 auto' }}>
                <header style={{ 'text-align': 'center', 'margin-bottom': '1.5rem' }}>
                    <h1 style={{ 'font-size': '2rem', 'font-weight': '700', margin: '0 0 0.5rem' }}>
                        Something went wrong
                    </h1>
                    <p class="text-muted">
                        JJHub hit an unexpected frontend error. The incident has been recorded.
                    </p>
                </header>

                {import.meta.env.DEV && (
                    <pre
                        style={{
                            'white-space': 'pre-wrap',
                            margin: '0 0 1.5rem',
                            padding: '1rem',
                            'border-radius': '12px',
                            background: 'rgba(15, 23, 42, 0.08)',
                            color: 'var(--text-primary)',
                        }}
                    >
                        {error.message}
                    </pre>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', 'justify-content': 'center', 'flex-wrap': 'wrap' }}>
                    <button class="btn btn-primary" type="button" onClick={reset}>
                        Try again
                    </button>
                    <button class="btn" type="button" onClick={() => window.location.reload()}>
                        Reload app
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function SentryAppBoundary(props: ParentProps) {
    return (
        <SentryErrorBoundary fallback={CrashFallback}>
            {props.children}
        </SentryErrorBoundary>
    );
}
