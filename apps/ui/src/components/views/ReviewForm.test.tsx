import { render, screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        MessageSquare: Icon,
        CheckCircle2: Icon,
        AlertCircle: Icon,
        X: Icon,
        LoaderCircle: Icon,
    };
});

vi.mock("../../lib/repoContext", () => ({
    repoApiFetch: vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({}), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        })),
    ),
}));

import ReviewForm from "./ReviewForm";

describe("ReviewForm", () => {
    const defaultProps = {
        landingId: "42",
        context: { owner: "alice", repo: "demo" },
        onSubmitted: vi.fn(),
        onClose: vi.fn(),
    };

    it("renders the submit review heading", async () => {
        render(() => <ReviewForm {...defaultProps} />);
        await waitFor(() => {
            expect(screen.getByRole("heading", { name: /submit review/i })).toBeInTheDocument();
        });
    });

    it("renders a textarea for review body", async () => {
        render(() => <ReviewForm {...defaultProps} />);
        await waitFor(() => {
            const textarea = document.querySelector("textarea");
            expect(textarea).toBeInTheDocument();
        });
    });

    it("renders the close button", async () => {
        render(() => <ReviewForm {...defaultProps} />);
        const buttons = screen.getAllByRole("button");
        expect(buttons.length).toBeGreaterThan(0);
    });
});
