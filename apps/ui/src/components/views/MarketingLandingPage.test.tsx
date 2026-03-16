import { render, screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        TerminalSquare: Icon,
        GitMerge: Icon,
        Layers: Icon,
        Bot: Icon,
        Code2: Icon,
        ArrowRight: Icon,
        BookOpen: Icon,
        Star: Icon,
        Zap: Icon,
        Shield: Icon,
        Globe: Icon,
        Laptop: Icon,
        CheckCircle: Icon,
        Banknote: Icon,
    };
});

vi.mock("./WaitlistForm", () => ({
    default: () => <div data-testid="waitlist-form">WaitlistForm</div>,
}));

import MarketingLandingPage from "./MarketingLandingPage";

describe("MarketingLandingPage", () => {
    it("renders the hero heading", async () => {
        render(() => <MarketingLandingPage />);
        await waitFor(() => {
            expect(screen.getByText(/agentic engineering/i)).toBeInTheDocument();
        });
    });

    it("shows the get early access CTA", async () => {
        render(() => <MarketingLandingPage />);
        await waitFor(() => {
            expect(screen.getByText("Get Early Access")).toBeInTheDocument();
        });
    });

    it("renders the waitlist form component", async () => {
        render(() => <MarketingLandingPage />);
        await waitFor(() => {
            expect(screen.getByTestId("waitlist-form")).toBeInTheDocument();
        });
    });
});
