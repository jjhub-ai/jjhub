// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repoContext = vi.hoisted(() => ({
    apiFetch: vi.fn(),
    clearLocalAuth: vi.fn(),
    setStoredToken: vi.fn(),
}));

vi.mock("lucide-solid", () => {
    const Icon = () => null;

    return {
        Github: Icon,
        Wallet: Icon,
        KeyRound: Icon,
        ShieldCheck: Icon,
        ArrowRight: Icon,
        TerminalSquare: Icon,
        Info: Icon,
        Loader2: Icon,
        AlertCircle: Icon,
        Mail: Icon,
        CheckCircle2: Icon,
    };
});

vi.mock("../../lib/repoContext", () => repoContext);

import LoginView from "./LoginView";

describe("LoginView", () => {
    beforeEach(() => {
        repoContext.clearLocalAuth.mockReset();
        repoContext.setStoredToken.mockReset();
        repoContext.apiFetch.mockReset();

        repoContext.setStoredToken.mockReturnValue(true);
        repoContext.apiFetch.mockImplementation(
            () => new Promise<Response>(() => {}),
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("submits the token form through the form submit path", async () => {
        render(() => <LoginView />);

        const tokenInput = screen.getByLabelText("Personal access token");
        await fireEvent.input(tokenInput, {
            currentTarget: { value: "jjhub_test_token" },
            target: { value: "jjhub_test_token" },
        });

        const tokenForm = tokenInput.closest("form");
        expect(tokenForm).not.toBeNull();

        await fireEvent.submit(tokenForm!);

        await waitFor(() => {
            expect(repoContext.setStoredToken).toHaveBeenCalledWith("jjhub_test_token");
            expect(repoContext.apiFetch).toHaveBeenCalledWith("/api/user");
        });
    });
});
