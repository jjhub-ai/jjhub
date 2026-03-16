import { render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        Bell: Icon,
        MessageSquare: Icon,
        Eye: Icon,
        GitMerge: Icon,
        Loader2: Icon,
        AlertCircle: Icon,
        Inbox: Icon,
        ChevronLeft: Icon,
        ChevronRight: Icon,
    };
});

vi.mock("../../lib/repoContext", () => ({
    apiFetch: vi.fn(() => Promise.resolve(new Response("{}", { status: 200 }))),
}));

vi.mock("../../lib/authenticatedEventSource", () => ({
    createAuthenticatedEventSource: vi.fn(() => ({
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        onerror: null,
    })),
}));

vi.mock("../../lib/navigationData", () => ({
    inboxNotificationsResource: {
        peek: () => undefined,
        key: () => "inbox-notifications",
        load: () => Promise.resolve({ items: [], total: 0 }),
    },
}));

import InboxView from "./InboxView";

describe("InboxView", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn(() =>
            Promise.resolve(new Response(JSON.stringify({ items: [], total: 0 }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })),
        ) as unknown as typeof fetch);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renders the inbox heading", async () => {
        render(() => <InboxView />);
        await waitFor(() => {
            expect(screen.getByText(/inbox/i)).toBeInTheDocument();
        });
    });

    it("shows empty state when no notifications exist", async () => {
        render(() => <InboxView />);
        await waitFor(() => {
            expect(screen.getByText(/no.*notification/i)).toBeInTheDocument();
        });
    });
});
