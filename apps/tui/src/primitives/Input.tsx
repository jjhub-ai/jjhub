import React, { useState, useCallback } from "react";
import { Box as InkBox, Text as InkText, useInput } from "ink";

export interface InputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  prompt?: string;
  active?: boolean;
}

export function Input({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder = "",
  prompt = "> ",
  active = true,
}: InputProps) {
  const [cursorPos, setCursorPos] = useState(value.length);

  useInput(
    (input, key) => {
      if (!active) return;

      if (key.return) {
        onSubmit?.(value);
        return;
      }

      if (key.escape) {
        onCancel?.();
        return;
      }

      if (key.backspace || key.delete) {
        if (cursorPos > 0) {
          const next = value.slice(0, cursorPos - 1) + value.slice(cursorPos);
          onChange(next);
          setCursorPos(cursorPos - 1);
        }
        return;
      }

      if (key.leftArrow) {
        setCursorPos(Math.max(0, cursorPos - 1));
        return;
      }

      if (key.rightArrow) {
        setCursorPos(Math.min(value.length, cursorPos + 1));
        return;
      }

      // ctrl+a: go to start
      if (input === "a" && key.ctrl) {
        setCursorPos(0);
        return;
      }

      // ctrl+e: go to end
      if (input === "e" && key.ctrl) {
        setCursorPos(value.length);
        return;
      }

      // ctrl+u: clear line
      if (input === "u" && key.ctrl) {
        onChange("");
        setCursorPos(0);
        return;
      }

      // ctrl+w: delete word
      if (input === "w" && key.ctrl) {
        const before = value.slice(0, cursorPos);
        const lastSpace = before.trimEnd().lastIndexOf(" ");
        const next = value.slice(0, lastSpace + 1) + value.slice(cursorPos);
        onChange(next);
        setCursorPos(lastSpace + 1);
        return;
      }

      // Regular character input
      if (input && !key.ctrl && !key.meta) {
        const next = value.slice(0, cursorPos) + input + value.slice(cursorPos);
        onChange(next);
        setCursorPos(cursorPos + input.length);
      }
    },
    { isActive: active },
  );

  const displayValue = value || placeholder;
  const isPlaceholder = !value && !!placeholder;

  return (
    <InkBox>
      <InkText color="cyan">{prompt}</InkText>
      <InkText dimColor={isPlaceholder}>
        {displayValue.slice(0, cursorPos)}
      </InkText>
      <InkText backgroundColor="white" color="black">
        {displayValue[cursorPos] ?? " "}
      </InkText>
      <InkText dimColor={isPlaceholder}>
        {displayValue.slice(cursorPos + 1)}
      </InkText>
    </InkBox>
  );
}
