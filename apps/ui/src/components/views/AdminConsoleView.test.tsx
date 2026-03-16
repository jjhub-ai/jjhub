import { render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@solidjs/router", () => ({
    useLocation: () => ({ pathname: "/admin" }),
}));

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        Activity: Icon,
        Boxes: Icon,
        Building2: Icon,
        Cpu: Icon,
        HeartPulse: Icon,
        Plus: Icon,
        Shield: Icon,
        Trash2: Icon,
        UserCog: Icon,
        Users: Icon,
        Workflow: Icon,
    };
});

vi.mock("../../lib/repoContext", () => ({
    withAuthHeaders: () => ({}),
}));

vi.mock("./viewSupport", () => ({
    daysAgoISOString: () => new Date().toISOString(),
    formatDateTime: (s: string) => s,
    readErrorMessage: () => "error",
}));

import AdminConsoleView from "./AdminConsoleView";

describe("AdminConsoleView", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn(() =>
            Promise.resolve(new Response(JSON.stringify({
                users: 5,
                orgs: 2,
                repos: 10,
                runners: 1,
            }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })),
        ) as unknown as typeof fetch);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renders the admin console navigation", async () => {
        render(() => <AdminConsoleView />);
        await waitFor(() => {
            expect(screen.getByText("Overview")).toBeInTheDocument();
        });
    });

    it("shows the users section link", async () => {
        render(() => <AdminConsoleView />);
        await waitFor(() => {
            expect(screen.getByText("Users")).toBeInTheDocument();
        });
    });
});
