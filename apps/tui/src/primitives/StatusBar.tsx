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
}

export function StatusBar({ bindings, left, right }: StatusBarProps) {
  return (
    <InkBox
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
      width="100%"
    >
      <InkBox gap={2}>
        {left && <InkText dimColor>{left}</InkText>}
        {bindings.map((b) => (
          <InkBox key={b.key} gap={0}>
            <InkText color="yellow" bold>
              {b.key}
            </InkText>
            <InkText dimColor> {b.label}</InkText>
          </InkBox>
        ))}
      </InkBox>
      {right && <InkText dimColor>{right}</InkText>}
    </InkBox>
  );
}
