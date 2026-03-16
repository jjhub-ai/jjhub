// @vitest-environment jsdom
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import DiffFileTree from "./DiffFileTree";

describe("DiffFileTree", () => {
    it("renders files and forwards selection", async () => {
        const onFileSelect = vi.fn();

        render(() => (
            <DiffFileTree
                files={[{
                    id: "chg-1:README.md",
                    path: "README.md",
                    changeType: "modified",
                    additions: 3,
                    deletions: 1,
                    collapsed: false,
                    generated: false,
                }]}
                activeFileId="chg-1:README.md"
                width={280}
                onWidthChange={vi.fn()}
                onFileSelect={onFileSelect}
            />
        ));

        expect(screen.getByText("README.md")).toBeInTheDocument();
        expect(screen.getByText("+3")).toBeInTheDocument();

        await fireEvent.click(screen.getByRole("treeitem", { name: /README\.md/i }));
        expect(onFileSelect).toHaveBeenCalledWith("chg-1:README.md");
    });
});
