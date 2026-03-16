import { render, screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

vi.mock("@solidjs/router", () => ({
    A: (props: Record<string, unknown>) => props.children,
}));

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        Search: Icon,
        Home: Icon,
        FileQuestion: Icon,
        ArrowLeft: Icon,
    };
});

import NotFoundView from "./NotFoundView";

describe("NotFoundView", () => {
    it("renders the 404 error code", async () => {
        render(() => <NotFoundView />);
        await waitFor(() => {
            expect(screen.getByText("404")).toBeInTheDocument();
        });
    });

    it("renders the page not found heading", async () => {
        render(() => <NotFoundView />);
        await waitFor(() => {
            expect(screen.getByText("Page Not Found")).toBeInTheDocument();
        });
    });

    it("shows a back to dashboard link", async () => {
        render(() => <NotFoundView />);
        await waitFor(() => {
            expect(screen.getByText("Back to Dashboard")).toBeInTheDocument();
        });
    });
});
