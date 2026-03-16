import { render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@solidjs/router", () => ({
    useParams: () => ({ username: "alice" }),
    A: (props: Record<string, unknown>) => props.children,
}));

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        MapPin: Icon,
        Mail: Icon,
        Building2: Icon,
        Book: Icon,
        Star: Icon,
        Activity: Icon,
        Users: Icon,
        Edit2: Icon,
        GitCommit: Icon,
        LogIn: Icon,
        Key: Icon,
        HelpCircle: Icon,
    };
});

vi.mock("../../lib/repoContext", () => ({
    apiFetch: vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({
            id: 1,
            username: "alice",
            display_name: "Alice",
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        })),
    ),
    withAuthHeaders: () => ({}),
}));

import UserProfile from "./UserProfile";

describe("UserProfile", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn(() =>
            Promise.resolve(new Response(JSON.stringify([]), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })),
        ) as unknown as typeof fetch);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renders the user profile view", async () => {
        render(() => <UserProfile />);
        await waitFor(() => {
            expect(document.body.textContent).toBeTruthy();
        });
    });
});
