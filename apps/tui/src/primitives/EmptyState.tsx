import React from "react";
import { Box as InkBox, Text as InkText } from "ink";

export interface EmptyStateProps {
  /** Primary message, e.g. "No issues found" */
  message: string;
  /** Optional hint with keybinding, e.g. "Press 'c' to create one." */
  hint?: string;
  /** Optional icon to show above the message */
  icon?: string;
}

/**
 * Consistent empty state display for lists with zero items.
 * Shows a centered message with optional hint text.
 */
export function EmptyState({ message, hint, icon }: EmptyStateProps) {
  return (
    <InkBox flexDirection="column" paddingY={1} paddingX={2} alignItems="flex-start">
      {icon && (
        <InkText dimColor>{icon}</InkText>
      )}
      <InkText dimColor>{message}</InkText>
      {hint && (
        <InkBox marginTop={1}>
          <InkText dimColor>{hint}</InkText>
        </InkBox>
      )}
    </InkBox>
  );
}
