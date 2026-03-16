import { render, screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        Settings: Icon,
        User: Icon,
        Key: Icon,
        Shield: Icon,
        Link2: Icon,
        BookOpen: Icon,
    };
});

vi.mock("../../layouts/AppLayout", () => ({
    useAuth: () => ({
        user: () => ({ id: 1, username: "alice", display_name: "Alice", email: "alice@test.com" }),
        isLoading: () => false,
    }),
}));

import SettingsView from "./SettingsView";

describe("SettingsView", () => {
    it("renders the user settings heading", async () => {
        render(() => <SettingsView />);
        await waitFor(() => {
            expect(screen.getByText("User Settings")).toBeInTheDocument();
        });
    });

    it("shows the identity section", async () => {
        render(() => <SettingsView />);
        await waitFor(() => {
            expect(screen.getByText("Identity")).toBeInTheDocument();
        });
    });

    it("shows the credentials section", async () => {
        render(() => <SettingsView />);
        await waitFor(() => {
            expect(screen.getByText("Credentials")).toBeInTheDocument();
        });
    });
});
