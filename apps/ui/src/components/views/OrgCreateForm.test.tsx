import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { navigateMock } = vi.hoisted(() => ({
    navigateMock: vi.fn(),
}));

vi.mock("@solidjs/router", () => ({
    useNavigate: () => navigateMock,
}));

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        Building2: Icon,
        ShieldAlert: Icon,
        Globe: Icon,
        Lock: Icon,
    };
});

vi.mock("../../lib/repoContext", () => ({
    withAuthHeaders: (extra?: Record<string, string>) => ({ ...extra }),
}));

import OrgCreateForm from "./OrgCreateForm";

describe("OrgCreateForm", () => {
    beforeEach(() => {
        navigateMock.mockReset();
        vi.stubGlobal("fetch", vi.fn(() =>
            Promise.resolve(new Response(JSON.stringify({ name: "my-org" }), {
                status: 201,
                headers: { "Content-Type": "application/json" },
            })),
        ) as unknown as typeof fetch);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renders the create organization form", async () => {
        render(() => <OrgCreateForm />);
        await waitFor(() => {
            expect(screen.getByRole("heading", { name: /create.*organization/i })).toBeInTheDocument();
        });
    });

    it("validates empty org name on submit", async () => {
        render(() => <OrgCreateForm />);

        const form = await waitFor(() =>
            document.querySelector("form")!,
        );
        await fireEvent.submit(form);

        await waitFor(() => {
            expect(screen.getByText(/organization name is required/i)).toBeInTheDocument();
        });
    });
});
