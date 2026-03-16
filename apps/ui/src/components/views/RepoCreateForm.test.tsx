import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { navigateMock } = vi.hoisted(() => ({
    navigateMock: vi.fn(),
}));

vi.mock("@solidjs/router", () => ({
    A: (props: Record<string, unknown>) => props.children,
    useNavigate: () => navigateMock,
}));

vi.mock("lucide-solid", () => {
    const Icon = () => null;

    return {
        BookOpen: Icon,
        Building2: Icon,
        CopyPlus: Icon,
        Database: Icon,
        Download: Icon,
        FileText: Icon,
        GitBranch: Icon,
        Globe: Icon,
        Lock: Icon,
        ShieldAlert: Icon,
        User: Icon,
    };
});

import RepoCreateForm from "./RepoCreateForm";

describe("RepoCreateForm", () => {
    beforeEach(() => {
        navigateMock.mockReset();

        const localStorageMock = {
            getItem: vi.fn(() => null),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
            key: vi.fn(),
            length: 0,
        };

        vi.stubGlobal("localStorage", localStorageMock);
        Object.defineProperty(window, "localStorage", {
            configurable: true,
            value: localStorageMock,
        });
    });

    function installFetchMock() {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const requestUrl =
                typeof input === "string"
                    ? input
                    : input instanceof URL
                      ? input.toString()
                      : input.url;
            const url = new URL(requestUrl, window.location.origin);

            if (url.pathname === "/api/user") {
                return new Response(
                    JSON.stringify({ id: 1, username: "alice", display_name: "Alice" }),
                    { status: 200, headers: { "Content-Type": "application/json" } },
                );
            }

            if (url.pathname === "/api/user/orgs") {
                return new Response(JSON.stringify([]), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }

            if (url.pathname === "/api/user/repos" && init?.method === "POST") {
                return new Response(
                    JSON.stringify({ owner: "alice", name: "demo" }),
                    { status: 201, headers: { "Content-Type": "application/json" } },
                );
            }

            return new Response("Not Found", { status: 404 });
        });

        vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
        return fetchMock;
    }

    it("sends auto-init and default bookmark in the create request", async () => {
        const fetchMock = installFetchMock();

        render(() => <RepoCreateForm />);

        await fireEvent.input(screen.getByLabelText("Repository Name"), {
            target: { value: "demo" },
        });
        await fireEvent.input(screen.getByLabelText("Default Bookmark"), {
            target: { value: "trunk" },
        });
        await fireEvent.click(screen.getByRole("button", { name: "Create Repository" }));

        await waitFor(() => {
            expect(navigateMock).toHaveBeenCalledWith("/alice/demo/code");
        });

        const createCall = fetchMock.mock.calls.find(([input, init]) => {
            const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
            return url === "/api/user/repos" && init?.method === "POST";
        });

        expect(createCall).toBeDefined();
        expect(JSON.parse((createCall?.[1]?.body as string) ?? "{}")).toEqual({
            name: "demo",
            description: "",
            private: true,
            auto_init: true,
            default_bookmark: "trunk",
        });
        expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
    });

    it("sends auto_init false and defaults blank bookmarks to main", async () => {
        const fetchMock = installFetchMock();

        render(() => <RepoCreateForm />);

        await fireEvent.input(screen.getByLabelText("Repository Name"), {
            target: { value: "demo" },
        });
        await fireEvent.input(screen.getByLabelText("Default Bookmark"), {
            target: { value: "" },
        });
        await fireEvent.click(screen.getByRole("checkbox", { name: "Initialize this repository with a README" }));
        await fireEvent.click(screen.getByRole("button", { name: "Create Repository" }));

        await waitFor(() => {
            expect(navigateMock).toHaveBeenCalledWith("/alice/demo/code");
        });

        const createCall = fetchMock.mock.calls.find(([input, init]) => {
            const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
            return url === "/api/user/repos" && init?.method === "POST";
        });

        expect(createCall).toBeDefined();
        expect(JSON.parse((createCall?.[1]?.body as string) ?? "{}")).toEqual({
            name: "demo",
            description: "",
            private: true,
            auto_init: false,
            default_bookmark: "main",
        });
    });
});
