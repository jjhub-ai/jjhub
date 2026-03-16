import React from "react";
import { Box as InkBox, Text as InkText } from "ink";

export interface KeyBinding {
  key: string;
  label: string;
}

export interface StatusBarProps {
  bindings: KeyBinding[];
  left?: string;
  right?: string;
  /** Show a connection status indicator: "online", "syncing", "offline" */
  connectionStatus?: "online" | "syncing" | "offline";
}

function connectionDot(status: "online" | "syncing" | "offline"): { dot: string; color: string } {
  switch (status) {
    case "online":
      return { dot: "\u25CF", color: "green" };
    case "syncing":
      return { dot: "\u25D0", color: "yellow" };
    case "offline":
      return { dot: "\u25CB", color: "red" };
  }
}

export function StatusBar({ bindings, left, right, connectionStatus }: StatusBarProps) {
  return (
    <InkBox
      paddingX={1}
      justifyContent="space-between"
      width="100%"
    >
      <InkBox gap={2}>
        {connectionStatus && (() => {
          const { dot, color } = connectionDot(connectionStatus);
          return (
            <InkBox gap={1}>
              <InkText color={color}>{dot}</InkText>
            </InkBox>
          );
        })()}
        {left && <InkText dimColor>{left}</InkText>}
        <InkText dimColor>|</InkText>
        {bindings.map((b) => (
          <InkBox key={b.key} gap={0}>
            <InkText color="yellow" bold>
              {b.key}
            </InkText>
            <InkText dimColor> {b.label}</InkText>
          </InkBox>
        ))}
      </InkBox>
      <InkBox gap={1}>
        {right && <InkText dimColor>{right}</InkText>}
        <InkText dimColor>?</InkText>
        <InkText dimColor>help</InkText>
      </InkBox>
    </InkBox>
  );
}
