import React, { useState } from "react";
import { Box as InkBox, Text as InkText, useInput } from "ink";

export interface ScrollViewProps {
  children: React.ReactNode[];
  maxVisible?: number;
  active?: boolean;
  showScrollbar?: boolean;
}

export function ScrollView({
  children,
  maxVisible = 20,
  active = true,
  showScrollbar = true,
}: ScrollViewProps) {
  const [offset, setOffset] = useState(0);
  const totalItems = React.Children.count(children);
  const maxOffset = Math.max(0, totalItems - maxVisible);

  useInput(
    (input, key) => {
      if (!active) return;

      if (input === "j" || key.downArrow) {
        setOffset((o) => Math.min(o + 1, maxOffset));
      }
      if (input === "k" || key.upArrow) {
        setOffset((o) => Math.max(o - 1, 0));
      }
      if (input === "d" && key.ctrl) {
        setOffset((o) => Math.min(o + Math.floor(maxVisible / 2), maxOffset));
      }
      if (input === "u" && key.ctrl) {
        setOffset((o) => Math.max(o - Math.floor(maxVisible / 2), 0));
      }
      if (input === "g") {
        setOffset(0);
      }
      if (input === "G") {
        setOffset(maxOffset);
      }
    },
    { isActive: active },
  );

  const childArray = React.Children.toArray(children);
  const visible = childArray.slice(offset, offset + maxVisible);

  return (
    <InkBox flexDirection="row">
      <InkBox flexDirection="column" flexGrow={1}>
        {visible}
      </InkBox>
      {showScrollbar && totalItems > maxVisible && (
        <InkBox flexDirection="column" marginLeft={1}>
          {Array.from({ length: maxVisible }).map((_, i) => {
            const scrollbarPos = Math.round(
              (offset / maxOffset) * (maxVisible - 1),
            );
            const isThumb = i === scrollbarPos;
            return (
              <InkText key={i} color={isThumb ? "cyan" : "gray"}>
                {isThumb ? "\u2588" : "\u2502"}
              </InkText>
            );
          })}
        </InkBox>
      )}
    </InkBox>
  );
}
