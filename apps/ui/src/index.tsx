import { render } from 'solid-js/web';
import App from './App';
import { initFeatureFlags } from './lib/featureFlags';
import { initGlobalErrorHandlers } from './lib/errorReporting';
import { initSentry } from './lib/sentry';
import SentryAppBoundary from './components/SentryAppBoundary';

initSentry();
void initFeatureFlags();
initGlobalErrorHandlers();

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
    throw new Error(
        'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got mispelled?',
    );
}

render(() => (
    <SentryAppBoundary>
        <App />
    </SentryAppBoundary>
), root!);
