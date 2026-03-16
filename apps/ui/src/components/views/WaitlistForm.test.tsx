import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        Mail: Icon,
        CheckCircle2: Icon,
        AlertCircle: Icon,
        ArrowRight: Icon,
    };
});

import WaitlistForm from "./WaitlistForm";

describe("WaitlistForm", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn(() =>
            Promise.resolve(new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })),
        ) as unknown as typeof fetch);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renders the join waitlist heading", async () => {
        render(() => <WaitlistForm />);
        await waitFor(() => {
            expect(screen.getByText(/join the waitlist/i)).toBeInTheDocument();
        });
    });

    it("renders the request access button", async () => {
        render(() => <WaitlistForm />);
        await waitFor(() => {
            expect(screen.getByText("Request Access")).toBeInTheDocument();
        });
    });

    it("shows error when submitting with empty email", async () => {
        render(() => <WaitlistForm />);
        const submitButton = screen.getByText("Request Access");
        await fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText("Email is required.")).toBeInTheDocument();
        });
    });
});
