export type AgentMessagePart = {
    part_index?: number;
    type: string;
    content: unknown;
};

export type PersistedAgentMessage = {
    id: number | string;
    role: string;
    created_at: string;
    parts?: AgentMessagePart[];
    content?: string;
    tool_calls?: Array<{
        function?: {
            name?: string;
            arguments?: string;
        };
    }>;
    token_count?: number;
};

export type NormalizedAgentMessage = {
    text: string;
    toolName: string;
    type: "text" | "tool_call" | "tool_result";
};

function renderJSONContent(raw: string): string {
    if (!raw.trim()) {
        return "";
    }

    try {
        return renderPartContent(JSON.parse(raw));
    } catch {
        return raw;
    }
}

function renderPartContent(content: unknown): string {
    if (content === null || content === undefined) {
        return "";
    }

    if (typeof content === "string") {
        return renderJSONContent(content);
    }

    if (Array.isArray(content)) {
        return content
            .map((value) => renderPartContent(value))
            .filter((value) => value !== "")
            .join("\n");
    }

    if (typeof content === "object") {
        const record = content as Record<string, unknown>;

        if (typeof record.value === "string" && record.value.trim() !== "") {
            return record.value;
        }
        if (typeof record.output === "string" && record.output.trim() !== "") {
            return record.output;
        }
        if (typeof record.error === "string" && record.error.trim() !== "") {
            return record.error;
        }
        if (typeof record.arguments === "string" && record.arguments.trim() !== "") {
            return record.arguments;
        }
    }

    try {
        return JSON.stringify(content);
    } catch {
        return String(content);
    }
}

function normalizeToolPart(part: AgentMessagePart): NormalizedAgentMessage {
    const content =
        typeof part.content === "object" && part.content !== null
            ? (part.content as Record<string, unknown>)
            : {};
    const nestedFunction =
        typeof content.function === "object" && content.function !== null
            ? (content.function as Record<string, unknown>)
            : null;
    const toolName =
        typeof content.name === "string" && content.name.trim() !== ""
            ? content.name
            : typeof nestedFunction?.name === "string" && nestedFunction.name.trim() !== ""
                ? nestedFunction.name
                : part.type === "tool_result"
                    ? "Tool Result"
                    : "Tool";

    const argsSource =
        content.input ??
        content.arguments ??
        content.output ??
        nestedFunction?.arguments ??
        content;

    return {
        type: part.type === "tool_result" ? "tool_result" : "tool_call",
        toolName,
        text: renderPartContent(argsSource),
    };
}

export function normalizePersistedAgentMessage(message: PersistedAgentMessage): NormalizedAgentMessage {
    if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        return {
            type: "tool_call",
            toolName: toolCall.function?.name || "Tool",
            text: toolCall.function?.arguments || "",
        };
    }

    const toolPart = message.parts?.find((part) => part.type === "tool_call" || part.type === "tool_result");
    if (toolPart) {
        return normalizeToolPart(toolPart);
    }

    const text = message.parts && message.parts.length > 0
        ? message.parts
            .map((part) => renderPartContent(part.content).trim())
            .filter((value) => value !== "")
            .join("\n")
        : renderPartContent(message.content).trim();

    return {
        type: "text",
        toolName: "",
        text,
    };
}
