import { describe, expect, it } from "vitest";
import { filterPaletteItems, fuzzyScore } from "./commandPaletteSearch";

describe("command palette search", () => {
    const items = [
        { label: "Go to Repositories" },
        { label: "Go to Inbox" },
        { label: "Comment on Issue", sublabel: "Issue detail actions" },
        { label: "Open Keyboard Shortcuts" },
    ];

    it("prefers stronger fuzzy matches when ranking actions", () => {
        const results = filterPaletteItems(items, "gtr");

        expect(results[0]?.label).toBe("Go to Repositories");
        expect(results.map((item) => item.label)).not.toContain("Comment on Issue");
    });

    it("matches action sublabels as part of the palette search text", () => {
        const results = filterPaletteItems(items, "detail");

        expect(results).toEqual([
            expect.objectContaining({ label: "Comment on Issue" }),
        ]);
    });

    it("returns a miss when the query is not a fuzzy subsequence", () => {
        expect(fuzzyScore("zzz", "Go to Repositories")).toBe(-1);
    });
});
