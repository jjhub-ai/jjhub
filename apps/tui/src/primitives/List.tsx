import React, { useState, useCallback } from "react";
import { Box as InkBox, Text as InkText, useInput } from "ink";

export interface ListItem {
  key: string;
  label: string;
  description?: string;
  badge?: { text: string; color: string };
}

export interface ListProps {
  items: ListItem[];
  onSelect?: (item: ListItem, index: number) => void;
  onHighlight?: (item: ListItem, index: number) => void;
  maxVisible?: number;
  active?: boolean;
}

export function List({
  items,
  onSelect,
  onHighlight,
  maxVisible = 20,
  active = true,
}: ListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);

  useInput(
    (input, key) => {
      if (!active) return;

      if (input === "j" || key.downArrow) {
        const next = Math.min(selectedIndex + 1, items.length - 1);
        setSelectedIndex(next);
        if (next >= scrollOffset + maxVisible) {
          setScrollOffset(next - maxVisible + 1);
        }
        onHighlight?.(items[next]!, next);
      }

      if (input === "k" || key.upArrow) {
        const next = Math.max(selectedIndex - 1, 0);
        setSelectedIndex(next);
        if (next < scrollOffset) {
          setScrollOffset(next);
        }
        onHighlight?.(items[next]!, next);
      }

      if (key.return) {
        const item = items[selectedIndex];
        if (item) onSelect?.(item, selectedIndex);
      }

      // Page down with ctrl+d
      if (input === "d" && key.ctrl) {
        const jump = Math.floor(maxVisible / 2);
        const next = Math.min(selectedIndex + jump, items.length - 1);
        setSelectedIndex(next);
        setScrollOffset(Math.max(0, next - Math.floor(maxVisible / 2)));
        onHighlight?.(items[next]!, next);
      }

      // Page up with ctrl+u
      if (input === "u" && key.ctrl) {
        const jump = Math.floor(maxVisible / 2);
        const next = Math.max(selectedIndex - jump, 0);
        setSelectedIndex(next);
        setScrollOffset(Math.max(0, next - Math.floor(maxVisible / 2)));
        onHighlight?.(items[next]!, next);
      }

      // Go to top with g
      if (input === "g") {
        setSelectedIndex(0);
        setScrollOffset(0);
        onHighlight?.(items[0]!, 0);
      }

      // Go to bottom with G
      if (input === "G") {
        const last = items.length - 1;
        setSelectedIndex(last);
        setScrollOffset(Math.max(0, last - maxVisible + 1));
        onHighlight?.(items[last]!, last);
      }
    },
    { isActive: active },
  );

  if (items.length === 0) {
    return (
      <InkBox>
        <InkText dimColor>No items</InkText>
      </InkBox>
    );
  }

  const visibleItems = items.slice(scrollOffset, scrollOffset + maxVisible);

  return (
    <InkBox flexDirection="column">
      {visibleItems.map((item, i) => {
        const absoluteIndex = scrollOffset + i;
        const isSelected = absoluteIndex === selectedIndex;
        return (
          <InkBox key={item.key} gap={1}>
            <InkText color={isSelected ? "cyan" : undefined}>
              {isSelected ? ">" : " "}
            </InkText>
            <InkText bold={isSelected} color={isSelected ? "white" : undefined}>
              {item.label}
            </InkText>
            {item.badge && (
              <InkText color={item.badge.color}>[{item.badge.text}]</InkText>
            )}
            {item.description && (
              <InkText dimColor wrap="truncate">
                {item.description}
              </InkText>
            )}
          </InkBox>
        );
      })}
      {items.length > maxVisible && (
        <InkBox marginTop={1}>
          <InkText dimColor>
            {scrollOffset + 1}-
            {Math.min(scrollOffset + maxVisible, items.length)} of{" "}
            {items.length}
          </InkText>
        </InkBox>
      )}
    </InkBox>
  );
}
