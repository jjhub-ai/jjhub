import React from "react";
import { Box as InkBox, type BoxProps as InkBoxProps } from "ink";

export interface BoxProps {
  flexDirection?: "row" | "column";
  gap?: number;
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  borderStyle?: "single" | "double" | "round" | "bold" | "classic";
  borderColor?: string;
  width?: number | string;
  height?: number | string;
  flexGrow?: number;
  flexShrink?: number;
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch";
  justifyContent?:
    | "flex-start"
    | "center"
    | "flex-end"
    | "space-between"
    | "space-around";
  children?: React.ReactNode;
}

export function Box({
  flexDirection = "column",
  gap,
  padding,
  paddingX,
  paddingY,
  paddingLeft,
  paddingRight,
  paddingTop,
  paddingBottom,
  marginTop,
  marginBottom,
  marginLeft,
  marginRight,
  borderStyle,
  borderColor,
  width,
  height,
  flexGrow,
  flexShrink,
  alignItems,
  justifyContent,
  children,
}: BoxProps) {
  return (
    <InkBox
      flexDirection={flexDirection}
      gap={gap}
      padding={padding}
      paddingX={paddingX}
      paddingY={paddingY}
      paddingLeft={paddingLeft}
      paddingRight={paddingRight}
      paddingTop={paddingTop}
      paddingBottom={paddingBottom}
      marginTop={marginTop}
      marginBottom={marginBottom}
      marginLeft={marginLeft}
      marginRight={marginRight}
      borderStyle={borderStyle}
      borderColor={borderColor}
      width={width as number | undefined}
      height={height as number | undefined}
      flexGrow={flexGrow}
      flexShrink={flexShrink}
      alignItems={alignItems}
      justifyContent={justifyContent}
    >
      {children}
    </InkBox>
  );
}
