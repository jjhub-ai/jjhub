// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { repoApiFetch } from "./repoContext";

describe("repoApiFetch", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns a synthetic 400 response instead of calling fetch without a repo context", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const response = await repoApiFetch("/workspace/sessions", {
            method: "POST",
        }, {
            owner: "",
            repo: "",
        });

        expect(response.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toEqual({
            message: "Repository context is required for repo-scoped API requests.",
        });
    });
});
