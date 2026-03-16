import { describe, expect, it } from "vitest";
import { formatIssueLabelColor } from "./issueLabelColor";

describe("formatIssueLabelColor", () => {
    it("preserves a single leading hash", () => {
        expect(formatIssueLabelColor("#ff00aa")).toBe("#ff00aa");
    });

    it("adds a hash when the API returns a bare hex value", () => {
        expect(formatIssueLabelColor("00ff88")).toBe("#00ff88");
    });
});
