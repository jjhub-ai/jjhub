import React from "react";
import { Box as InkBox, Text as InkText } from "ink";

export interface ErrorBoxProps {
  title?: string;
  message: string;
  hint?: string;
}

/**
 * Styled error display box with red border, error icon, and optional hint.
 * Use this instead of raw `<Text color="red">` for consistent error display.
 */
export function ErrorBox({ title = "Error", message, hint }: ErrorBoxProps) {
  return (
    <InkBox
      flexDirection="column"
      borderStyle="round"
      borderColor="red"
      paddingX={2}
      paddingY={1}
    >
      <InkBox gap={1}>
        <InkText color="red" bold>
          x
        </InkText>
        <InkText color="red" bold>
          {title}
        </InkText>
      </InkBox>
      <InkBox paddingLeft={2}>
        <InkText color="red">{message}</InkText>
      </InkBox>
      {hint && (
        <InkBox paddingLeft={2} marginTop={1}>
          <InkText dimColor>{hint}</InkText>
        </InkBox>
      )}
    </InkBox>
  );
}
