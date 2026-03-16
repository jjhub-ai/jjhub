// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authContext = vi.hoisted(() => ({
    user: () => ({ id: 1, username: "will", display_name: "Will" }),
    isLoading: () => false,
}));

vi.mock("lucide-solid", () => {
    const Icon = () => null;

    return {
        Trash2: Icon,
        RefreshCw: Icon,
        Link2: Icon,
    };
});

vi.mock("../../layouts/AppLayout", () => {
    return {
        useAuth: () => authContext,
    };
});

import LinearIntegrationSetup from "./LinearIntegrationSetup";

describe("LinearIntegrationSetup", () => {
    let fetchMock: typeof fetch;
    let postBodies: Array<Record<string, unknown>>;

    beforeEach(() => {
        let listCalls = 0;
        postBodies = [];

        window.history.replaceState(
            {},
            "",
            "/integrations/linear?setup=setup-123",
        );

        fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
            const requestUrl =
                typeof input === "string"
                    ? input
                    : input instanceof URL
                      ? input.toString()
                      : input.url;
            const method =
                init?.method ??
                (input instanceof Request ? input.method : "GET");
            const url = new URL(requestUrl, window.location.origin);

            if (url.pathname === "/api/integrations/linear" && method === "GET") {
                listCalls += 1;
                const body = listCalls > 1
                    ? [{
                        id: 7,
                        linear_team_id: "team-1",
                        linear_team_name: "Platform",
                        linear_team_key: "PLT",
                        repo_owner: "acme",
                        repo_name: "demo",
                        repo_id: 42,
                        is_active: true,
                        last_sync_at: null,
                        created_at: "2026-03-12T00:00:00Z",
                    }]
                    : [];
                return new Response(JSON.stringify(body), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }

            if (url.pathname === "/api/integrations/linear/repositories" && method === "GET") {
                return new Response(JSON.stringify([
                    { id: 42, owner: "acme", name: "demo", description: "Demo repository" },
                ]), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }

            if (url.pathname === "/api/integrations/linear/setup/setup-123" && method === "GET") {
                return new Response(JSON.stringify({
                    viewer: { id: "actor-1", name: "Alice", email: "alice@example.com" },
                    teams: [{ id: "team-1", name: "Platform", key: "PLT" }],
                }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }

            if (url.pathname === "/api/integrations/linear" && method === "POST") {
                const rawBody = init?.body;
                const parsed = typeof rawBody === "string" ? JSON.parse(rawBody) : {};
                postBodies.push(parsed);

                return new Response(JSON.stringify({ id: 7 }), {
                    status: 201,
                    headers: { "Content-Type": "application/json" },
                });
            }

            return new Response("Not Found", { status: 404 });
        }) as typeof fetch;

        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        window.history.replaceState({}, "", "/integrations/linear");
    });

    it("completes browser setup from the OAuth callback payload", async () => {
        const replaceStateSpy = vi.spyOn(window.history, "replaceState");

        render(() => <LinearIntegrationSetup />);

        await waitFor(() => {
            expect(screen.getByText("Complete setup")).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByRole("button", { name: "Connect Team" })).toBeEnabled();
        });

        expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/integrations/linear");
        expect(screen.getByText("Authorized as Alice (alice@example.com)")).toBeInTheDocument();

        await fireEvent.click(screen.getByRole("button", { name: "Connect Team" }));

        await waitFor(() => {
            expect(screen.getByText("Connected PLT to acme/demo.")).toBeInTheDocument();
        });

        expect(postBodies).toHaveLength(1);
        expect(postBodies[0]).toMatchObject({
            setup_key: "setup-123",
            linear_team_id: "team-1",
            linear_team_name: "Platform",
            linear_team_key: "PLT",
            repo_owner: "acme",
            repo_name: "demo",
            repo_id: 42,
        });

        await waitFor(() => {
            expect(screen.getByText("PLT")).toBeInTheDocument();
            expect(screen.getByText("acme/demo")).toBeInTheDocument();
        });
    });
});
