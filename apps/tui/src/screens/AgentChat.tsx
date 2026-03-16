import React, { useState, useCallback, useEffect } from "react";
import { useInput } from "ink";
import { Box, Text, Heading, Input, Spinner, StatusBar, ScrollView, ErrorBox, EmptyState } from "../primitives";
import { useAgentSession } from "../hooks";
import type { ChatMessage } from "../hooks/useAgentSession";
import { theme } from "../utils";

export interface AgentChatProps {
  owner: string;
  name: string;
  sessionId?: string;
  mode?: string; // "new" to start fresh
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

function roleColor(role: string): string {
  switch (role) {
    case "user": return "white";
    case "assistant": return theme.info;
    case "system": return theme.warning;
    default: return theme.muted;
  }
}

function roleLabel(role: string): string {
  switch (role) {
    case "user": return "you";
    case "assistant": return "agent";
    case "system": return "system";
    default: return role;
  }
}

function MessageLine({ message }: { message: ChatMessage }) {
  if (message.type === "tool_call" || message.type === "tool_result") {
    return (
      <Box gap={1}>
        <Text color={theme.agent} bold>
          {message.type === "tool_call" ? ">" : "<"}
        </Text>
        <Text color={theme.agent}>{message.toolName || "tool"}</Text>
        <Text dimColor wrap="truncate">
          {message.content.slice(0, 120)}
        </Text>
      </Box>
    );
  }

  const lines = message.content.split("\n");

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text color={roleColor(message.role)} bold>
          [{roleLabel(message.role)}]
        </Text>
        <Text dimColor>{message.timestamp}</Text>
      </Box>
      {lines.map((line, i) => (
        <Box key={`${message.id}-${i}`} paddingLeft={2}>
          <Text color={roleColor(message.role)} wrap="wrap">
            {line || " "}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

export function AgentChat({ owner, name, sessionId, mode, onNavigate }: AgentChatProps) {
  const [focus, setFocus] = useState<"input" | "history">(mode === "new" ? "input" : "history");
  const [inputValue, setInputValue] = useState("");

  const context = { owner, repo: name };
  const {
    messages,
    loading,
    error,
    streaming,
    sessionId: activeSessionId,
    createSession,
    sendMessage,
    loadSession,
  } = useAgentSession(context);

  // Load existing session on mount
  useEffect(() => {
    if (sessionId && mode !== "new") {
      loadSession(sessionId);
    }
  }, [sessionId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || streaming) return;

      setInputValue("");

      if (activeSessionId) {
        await sendMessage(trimmed);
      } else {
        await createSession(trimmed);
      }
    },
    [activeSessionId, streaming, sendMessage, createSession],
  );

  // Global keybindings when NOT in input mode
  useInput(
    (_input, key) => {
      if (key.tab) {
        setFocus((f) => (f === "input" ? "history" : "input"));
        return;
      }
    },
  );

  // History mode keybindings
  useInput(
    (input) => {
      if (input === "i") {
        setFocus("input");
      }
    },
    { isActive: focus === "history" },
  );

  const messageElements = messages.map((msg) => (
    <MessageLine key={String(msg.id)} message={msg} />
  ));

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Header */}
      <Box paddingX={1} gap={2}>
        <Heading>Agent Chat</Heading>
        {activeSessionId && (
          <Text dimColor>session: {activeSessionId.slice(0, 8)}</Text>
        )}
        {!activeSessionId && <Text dimColor>new session</Text>}
      </Box>

      {/* Messages area */}
      <Box
        flexDirection="column"
        flexGrow={1}
        paddingX={1}
        paddingY={1}
        borderStyle={focus === "history" ? "round" : "single"}
        borderColor={focus === "history" ? theme.borderFocused : theme.border}
      >
        {loading ? (
          <Spinner label="Loading messages..." />
        ) : error ? (
          <ErrorBox message={error.message} hint="Press Tab to switch to input and try again." />
        ) : messages.length === 0 ? (
          <EmptyState
            message="No messages yet."
            hint="Press Tab to switch to input, then type a message and press Enter to send."
          />
        ) : (
          <ScrollView
            maxVisible={16}
            active={focus === "history"}
            showScrollbar={true}
          >
            {messageElements}
          </ScrollView>
        )}

        {streaming && (
          <Box paddingTop={1}>
            <Spinner label="Agent is thinking..." color={theme.agent} />
          </Box>
        )}
      </Box>

      {/* Input area */}
      <Box
        paddingX={1}
        paddingY={1}
        borderStyle={focus === "input" ? "round" : "single"}
        borderColor={focus === "input" ? theme.borderFocused : theme.border}
      >
        <Input
          value={inputValue}
          onChange={setInputValue}
          placeholder={streaming ? "Agent is responding..." : "Type a message..."}
          prompt="> "
          active={focus === "input" && !streaming}
          onSubmit={() => {
            handleSubmit(inputValue);
          }}
          onCancel={() => {
            setFocus("history");
          }}
        />
      </Box>

      <StatusBar
        bindings={[
          { key: "Tab", label: "toggle focus" },
          { key: "Enter", label: "send" },
          { key: "j/k", label: "scroll" },
          { key: "Esc", label: "to history" },
          { key: "q", label: "back" },
        ]}
        left={
          focus === "input"
            ? "input"
            : `history (${messages.length} messages)`
        }
        right={streaming ? "streaming..." : undefined}
      />
    </Box>
  );
}
