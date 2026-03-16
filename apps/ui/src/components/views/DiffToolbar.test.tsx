// @vitest-environment jsdom
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import DiffToolbar from "./DiffToolbar";

describe("DiffToolbar", () => {
    it("renders toggle buttons and fires callbacks", async () => {
        const onViewModeChange = vi.fn();
        const onWhitespaceModeChange = vi.fn();
        const onExpandAll = vi.fn();
        const onCollapseAll = vi.fn();

        render(() => (
            <DiffToolbar
                viewMode="unified"
                whitespaceMode="show"
                onViewModeChange={onViewModeChange}
                onWhitespaceModeChange={onWhitespaceModeChange}
                onExpandAll={onExpandAll}
                onCollapseAll={onCollapseAll}
            />
        ));

        await fireEvent.click(screen.getByRole("button", { name: "Split" }));
        await fireEvent.click(screen.getByRole("button", { name: "Hide whitespace" }));
        await fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
        await fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));

        expect(onViewModeChange).toHaveBeenCalledWith("split");
        expect(onWhitespaceModeChange).toHaveBeenCalledWith("ignore");
        expect(onExpandAll).toHaveBeenCalledTimes(1);
        expect(onCollapseAll).toHaveBeenCalledTimes(1);
        expect(screen.getByText("`j`/`k` files")).toBeInTheDocument();
    });
});
