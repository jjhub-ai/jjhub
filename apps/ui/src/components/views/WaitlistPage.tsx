import WaitlistForm from "./WaitlistForm";
import "./LoginView.css";

export default function WaitlistPage() {
    return (
        <div class="login-container">
            <div class="glow-orb top-right"></div>
            <div class="glow-orb bottom-left"></div>

            <div class="login-content waitlist-page-content animate-in stagger-1">
                <header class="login-header waitlist-page-header">
                    <h1 class="waitlist-page-title">Join the Waitlist</h1>
                    <p class="text-muted">JJHub is currently in closed alpha. Sign up for early access.</p>
                </header>

                <WaitlistForm source="waitlist-page" />

                <p class="waitlist-page-signin text-muted">
                    Already have access? <a href="/login">Sign in</a>
                </p>
            </div>
        </div>
    );
}
