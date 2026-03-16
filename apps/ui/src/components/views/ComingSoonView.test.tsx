import { render, screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import ComingSoonView from "./ComingSoonView";

describe("ComingSoonView", () => {
    it("renders the provided title", async () => {
        render(() => <ComingSoonView title="Feature X" />);
        await waitFor(() => {
            expect(screen.getByText("Feature X")).toBeInTheDocument();
        });
    });

    it("renders the default description when none is provided", async () => {
        render(() => <ComingSoonView title="Feature Y" />);
        await waitFor(() => {
            expect(screen.getByText("Coming soon.")).toBeInTheDocument();
        });
    });

    it("renders a custom description when provided", async () => {
        render(() => <ComingSoonView title="Feature Z" description="Available next month." />);
        await waitFor(() => {
            expect(screen.getByText("Available next month.")).toBeInTheDocument();
        });
    });
});
