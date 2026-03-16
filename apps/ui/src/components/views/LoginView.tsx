import { createSignal, Show } from "solid-js";
import { Github, Wallet, KeyRound, ShieldCheck, ArrowRight, TerminalSquare, Info, Loader2, AlertCircle } from "lucide-solid";
import { apiFetch, clearLocalAuth, setStoredToken } from "../../lib/repoContext";
import WaitlistForm from "./WaitlistForm";
import "./LoginView.css";

// Minimal type for the injected wallet provider (EIP-1193).
// We keep naming generic — no mention of Ethereum or specific wallets in the UI.
interface WalletProvider {
    request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

declare global {
    interface Window {
        ethereum?: WalletProvider;
    }
}

export default function LoginView() {
    const [token, setToken] = createSignal("");
    const [isAuthenticating, setIsAuthenticating] = createSignal(false);
    const [authMethodInProgress, setAuthMethodInProgress] = createSignal<"key" | "github" | "token" | null>(null);
    const [errorMsg, setErrorMsg] = createSignal<string | null>(null);

    // --- GitHub OAuth (redirect-based) ---
    const handleGitHubAuth = () => {
        setErrorMsg(null);
        setIsAuthenticating(true);
        setAuthMethodInProgress("github");
        // Redirect to the backend, which redirects to GitHub. After the OAuth
        // dance, the backend sets a session cookie and redirects to "/".
        window.location.href = "/api/auth/github";
    };

    // --- Key Auth (challenge-response with the browser wallet provider) ---
    const handleKeyAuth = async () => {
        setErrorMsg(null);
        setIsAuthenticating(true);
        setAuthMethodInProgress("key");

        try {
            const provider = window.ethereum;
            if (!provider) {
                setErrorMsg("No key provider detected. Please install a compatible wallet extension.");
                return;
            }

            // 1. Request accounts from the wallet provider.
            const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
            if (!accounts || accounts.length === 0) {
                setErrorMsg("No account selected. Please unlock your wallet and try again.");
                return;
            }
            const address = accounts[0];

            // 2. Fetch a nonce from the backend.
            const nonceRes = await apiFetch("/api/auth/key/nonce");
            if (!nonceRes.ok) {
                const body = await nonceRes.json().catch(() => null);
                setErrorMsg(body?.message || "Failed to start authentication. Please try again.");
                return;
            }
            const { nonce } = await nonceRes.json();

            // 3. Construct the EIP-4361 message. The backend verifies domain, nonce,
            //    and recovers the signer address from the signature.
            const domain = window.location.host;
            const origin = window.location.origin;
            const issuedAt = new Date().toISOString();
            const message = [
                `${domain} wants you to sign in with your key:`,
                address,
                "",
                "Sign in to JJHub",
                "",
                `URI: ${origin}`,
                `Version: 1`,
                `Chain ID: 1`,
                `Nonce: ${nonce}`,
                `Issued At: ${issuedAt}`,
            ].join("\n");

            // 4. Ask the wallet to sign the message.
            const signature = (await provider.request({
                method: "personal_sign",
                params: [message, address],
            })) as string;

            // 5. Send to backend for verification.
            const verifyRes = await apiFetch("/api/auth/key/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message, signature }),
            });

            if (verifyRes.ok) {
                // The backend sets a session cookie; redirect to the app.
                window.location.href = "/";
            } else {
                const body = await verifyRes.json().catch(() => null);
                setErrorMsg(body?.message || "Verification failed. Please try again.");
            }
        } catch (err: unknown) {
            // Handle user rejection or other wallet errors gracefully.
            const message = err instanceof Error ? err.message : String(err);
            if (message.includes("User rejected") || message.includes("user rejected") || message.includes("4001")) {
                setErrorMsg("Request was cancelled.");
            } else {
                setErrorMsg("Authentication failed. Please try again.");
            }
        } finally {
            setIsAuthenticating(false);
            setAuthMethodInProgress(null);
        }
    };

    // --- PAT Token auth (fallback) ---
    const handleTokenAuth = async () => {
        const t = token().trim();
        if (!t) return;

        setIsAuthenticating(true);
        setErrorMsg(null);
        setAuthMethodInProgress("token");

        if (!setStoredToken(t)) {
            setErrorMsg("This browser blocked secure token storage. Please use GitHub OAuth or Key Auth.");
            setIsAuthenticating(false);
            setAuthMethodInProgress(null);
            return;
        }

        try {
            const res = await apiFetch("/api/user");
            if (res.ok) {
                window.location.href = "/";
            } else {
                clearLocalAuth();
                setErrorMsg("Invalid token. Please check your personal access token and try again.");
            }
        } catch {
            clearLocalAuth();
            setErrorMsg("Could not connect to the API. Please try again.");
        } finally {
            setIsAuthenticating(false);
            setAuthMethodInProgress(null);
        }
    };

    return (
        <div class="login-container">
            {/* Background elements for premium feel */}
            <div class="glow-orb top-right"></div>
            <div class="glow-orb bottom-left"></div>

            <div class="login-content animate-in stagger-1">
                <header class="login-header">
                    <div class="logo-mark">
                        <TerminalSquare size={32} class="text-primary" />
                    </div>
                    <h1>Welcome to JJHub</h1>
                    <p class="text-muted">Authenticate to access your workspace and AI agents.</p>
                </header>

                <div class="wip-notice animate-in stagger-2">
                    <div class="wip-notice-icon">
                        <Info size={18} />
                    </div>
                    <div class="wip-notice-content">
                        <p>
                            The web UI is still a work in progress. We recommend using the{" "}
                            <a href="https://docs.jjhub.tech/cli" target="_blank" rel="noopener noreferrer">
                                JJHub CLI
                            </a>{" "}
                            for the best experience. You can also add{" "}
                            <a href="https://docs.jjhub.tech/mcp" target="_blank" rel="noopener noreferrer">
                                docs.jjhub.tech/mcp
                            </a>{" "}
                            as an MCP server for AI-powered workflows.
                        </p>
                    </div>
                </div>

                <div class="auth-methods animate-in stagger-2">
                    <Show when={errorMsg()}>
                        <div class="auth-error-banner" role="alert">
                            <AlertCircle size={16} />
                            <span>{errorMsg()}</span>
                        </div>
                    </Show>

                    <div class="method-cards">
                        <button
                            class={`auth-card ${authMethodInProgress() === "key" ? "active" : ""}`}
                            disabled={isAuthenticating()}
                            onClick={handleKeyAuth}
                            type="button"
                            title="Sign in with your key"
                        >
                            <div class="card-icon crypto">
                                <Show when={authMethodInProgress() === "key"} fallback={<Wallet size={24} />}>
                                    <Loader2 size={24} class="spin" />
                                </Show>
                            </div>
                            <div class="card-body">
                                <h3>Sign in with Key</h3>
                                <p>
                                    <Show when={authMethodInProgress() === "key"} fallback="Use your key provider to authenticate">
                                        Waiting for signature...
                                    </Show>
                                </p>
                            </div>
                            <ArrowRight size={20} class="action-icon" />
                        </button>

                        <button
                            class={`auth-card ${authMethodInProgress() === "github" ? "active" : ""}`}
                            disabled={isAuthenticating()}
                            onClick={handleGitHubAuth}
                            type="button"
                            title="Continue with GitHub"
                        >
                            <div class="card-icon github">
                                <Show when={authMethodInProgress() === "github"} fallback={<Github size={24} />}>
                                    <Loader2 size={24} class="spin" />
                                </Show>
                            </div>
                            <div class="card-body">
                                <h3>Continue with GitHub</h3>
                                <p>
                                    <Show when={authMethodInProgress() === "github"} fallback="Authorize via GitHub OAuth">
                                        Redirecting to GitHub...
                                    </Show>
                                </p>
                            </div>
                            <ArrowRight size={20} class="action-icon" />
                        </button>
                    </div>

                    <div class="divider">
                        <span>or use a token</span>
                    </div>

                    <form
                        class="token-auth-form token-auth-section"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void handleTokenAuth();
                        }}
                    >
                        <div class="token-input-wrapper">
                            <label class="sr-only" for="login-token-input">Personal access token</label>
                            <KeyRound size={16} class="input-icon text-muted" />
                            <input
                                id="login-token-input"
                                name="access_token"
                                type="password"
                                placeholder="Paste your JJHub personal access token (jjhub_...)"
                                value={token()}
                                onInput={(e) => setToken(e.currentTarget.value)}
                                autocomplete="current-password"
                                autocapitalize="off"
                                autocorrect="off"
                                spellcheck={false}
                                disabled={isAuthenticating()}
                            />
                            <button
                                class="token-submit-btn"
                                disabled={!token() || isAuthenticating()}
                                type="submit"
                            >
                                <Show when={authMethodInProgress() === "token"} fallback="Connect">
                                    <Loader2 size={14} class="spin" />
                                </Show>
                            </button>
                        </div>
                    </form>

                    <WaitlistForm source="login" />
                </div>

                {/* Simulated CLI status footer */}
                <footer class="login-footer animate-in stagger-3">
                    <div class="status-indicator">
                        <div class={`status-dot ${isAuthenticating() ? 'pulsing' : ''}`}></div>
                        <span class="text-xs text-muted font-mono uppercase tracking-wider">
                            {isAuthenticating() ? "Authenticating session..." : "Ready for Authorization"}
                        </span>
                    </div>
                    <div class="security-badge hidden sm:flex">
                        <ShieldCheck size={14} class="text-green" />
                        <span>End-to-End Encrypted</span>
                    </div>
                </footer>
            </div>
        </div>
    );
}
