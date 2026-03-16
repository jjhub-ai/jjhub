import { render, screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

vi.mock("@solidjs/router", () => ({
    A: (props: Record<string, unknown>) => props.children,
}));

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        TerminalSquare: Icon,
        BookOpen: Icon,
        Send: Icon,
        Github: Icon,
        Twitter: Icon,
        MessageCircle: Icon,
        ArrowRight: Icon,
        Bot: Icon,
        Sparkles: Icon,
        Plus: Icon,
    };
});

import ThankYouPage from "./ThankYouPage";

describe("ThankYouPage", () => {
    it("renders the thank you heading", async () => {
        render(() => <ThankYouPage />);
        await waitFor(() => {
            expect(screen.getByText("You're on the list!")).toBeInTheDocument();
        });
    });

    it("shows the access request received badge", async () => {
        render(() => <ThankYouPage />);
        await waitFor(() => {
            expect(screen.getByText("Access Request Received")).toBeInTheDocument();
        });
    });

    it("shows the documentation link", async () => {
        render(() => <ThankYouPage />);
        await waitFor(() => {
            expect(screen.getByText("Documentation")).toBeInTheDocument();
        });
    });
});
