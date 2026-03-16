// @vitest-environment jsdom

import { render, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isTerminalOpen } from "../../stores/workbench";

const routerState = vi.hoisted(() => {
    let pathname = "/workspaces";

    return {
        get pathname() {
            return pathname;
        },
        setPathname(next: string) {
            pathname = next;
        },
    };
});

const terminalWrites = vi.hoisted(() => [] as string[]);

vi.mock("@solidjs/router", () => ({
    useLocation: () => ({ pathname: routerState.pathname }),
}));

vi.mock("lucide-solid", () => {
    const Icon = () => null;
    return {
        Plus: Icon,
        TerminalSquare: Icon,
        Trash2: Icon,
        X: Icon,
    };
});

vi.mock("xterm", () => ({
    Terminal: class MockTerminal {
        cols = 80;
        rows = 24;

        loadAddon() {}
        open() {}
        writeln(message: string) {
            terminalWrites.push(message);
        }
        onData() {
            return { dispose() {} };
        }
        dispose() {}
    },
}));

vi.mock("xterm-addon-fit", () => ({
    FitAddon: class MockFitAddon {
        fit() {}
    },
}));

import TerminalDock from "./TerminalDock";

describe("TerminalDock", () => {
    beforeEach(() => {
        routerState.setPathname("/workspaces");
        terminalWrites.length = 0;
        isTerminalOpen.set(true);
        vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
        isTerminalOpen.set(false);
        vi.unstubAllGlobals();
    });

    it("does not call repo-scoped workspace APIs when opened outside a repository route", async () => {
        const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;

        render(() => <TerminalDock />);

        await waitFor(() => {
            expect(terminalWrites.some((entry) => entry.includes("Open a repository route before starting a terminal session."))).toBe(true);
        });

        expect(fetchMock).not.toHaveBeenCalled();
    });
});
