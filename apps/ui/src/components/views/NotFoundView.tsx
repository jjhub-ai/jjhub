import { A } from "@solidjs/router";
import { Search, Home, FileQuestion, ArrowLeft } from "lucide-solid";
import "./NotFoundView.css";

export default function NotFoundView() {
    return (
        <div class="not-found-container">
            <div class="glow-orb top-right"></div>
            <div class="glow-orb bottom-left"></div>

            <div class="not-found-content animate-in">
                <div class="not-found-card">
                    <div class="not-found-icon">
                        <FileQuestion size={48} />
                    </div>
                    
                    <div class="not-found-header">
                        <span class="error-code">404</span>
                        <h1>Page Not Found</h1>
                        <p class="text-muted">
                            The page you're looking for doesn't exist or you don't have permission to view it.
                        </p>
                    </div>

                    <div class="not-found-actions">
                        <A href="/" class="btn-primary">
                            <Home size={18} />
                            <span>Back to Dashboard</span>
                        </A>
                        <A href="/search" class="btn-secondary">
                            <Search size={18} />
                            <span>Search JJHub</span>
                        </A>
                    </div>

                    <div class="not-found-footer">
                        <button class="btn-ghost" onClick={() => window.history.back()}>
                            <ArrowLeft size={16} />
                            <span>Go Back</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
