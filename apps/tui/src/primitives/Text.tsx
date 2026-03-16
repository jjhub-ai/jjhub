import React from "react";
import { Text as InkText } from "ink";

export interface TextProps {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  dimColor?: boolean;
  color?: string;
  backgroundColor?: string;
  wrap?: "wrap" | "truncate" | "truncate-start" | "truncate-middle";
  children?: React.ReactNode;
}

export function Text({
  bold,
  italic,
  underline,
  strikethrough,
  dimColor,
  color,
  backgroundColor,
  wrap,
  children,
}: TextProps) {
  return (
    <InkText
      bold={bold}
      italic={italic}
      underline={underline}
      strikethrough={strikethrough}
      dimColor={dimColor}
      color={color}
      backgroundColor={backgroundColor}
      wrap={wrap}
    >
      {children}
    </InkText>
  );
}

export function Label({
  label,
  value,
  labelColor = "gray",
  valueColor,
}: {
  label: string;
  value: string;
  labelColor?: string;
  valueColor?: string;
}) {
  return (
    <InkText>
      <InkText color={labelColor}>{label}: </InkText>
      <InkText color={valueColor} bold>
        {value}
      </InkText>
    </InkText>
  );
}

export function Heading({ children }: { children: React.ReactNode }) {
  return (
    <InkText bold color="cyan">
      {children}
    </InkText>
  );
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <InkText dimColor>{children}</InkText>;
}
