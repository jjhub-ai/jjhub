import { describe, expect, it } from "vitest";

import { normalizePersistedAgentMessage } from "./agentMessages";

describe("normalizePersistedAgentMessage", () => {
    it("renders persisted text parts from the current API shape", () => {
        expect(
            normalizePersistedAgentMessage({
                id: "sess-msg-1",
                role: "assistant",
                created_at: "2026-03-12T00:00:00Z",
                parts: [
                    {
                        type: "text",
                        content: { value: "hello replay" },
                    },
                ],
            }),
        ).toEqual({
            type: "text",
            toolName: "",
            text: "hello replay",
        });
    });

    it("extracts tool calls from structured tool_call parts", () => {
        expect(
            normalizePersistedAgentMessage({
                id: "sess-msg-2",
                role: "assistant",
                created_at: "2026-03-12T00:00:00Z",
                parts: [
                    {
                        type: "tool_call",
                        content: {
                            name: "read_file",
                            input: { path: "main.go" },
                        },
                    },
                ],
            }),
        ).toEqual({
            type: "tool_call",
            toolName: "read_file",
            text: "{\"path\":\"main.go\"}",
        });
    });

    it("falls back to legacy tool_calls payloads", () => {
        expect(
            normalizePersistedAgentMessage({
                id: "sess-msg-3",
                role: "assistant",
                created_at: "2026-03-12T00:00:00Z",
                tool_calls: [
                    {
                        function: {
                            name: "search_docs",
                            arguments: "{\"query\":\"agent\"}",
                        },
                    },
                ],
            }),
        ).toEqual({
            type: "tool_call",
            toolName: "search_docs",
            text: "{\"query\":\"agent\"}",
        });
    });
});
