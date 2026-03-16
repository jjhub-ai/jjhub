import React from "react";
import { Box as InkBox, Text as InkText } from "ink";

export interface Column<T> {
  key: keyof T & string;
  header: string;
  width?: number;
  align?: "left" | "right" | "center";
  color?: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  selectedIndex?: number;
}

function pad(str: string, width: number, align: "left" | "right" | "center" = "left"): string {
  if (str.length >= width) return str.slice(0, width);
  const diff = width - str.length;
  switch (align) {
    case "right":
      return " ".repeat(diff) + str;
    case "center": {
      const left = Math.floor(diff / 2);
      return " ".repeat(left) + str + " ".repeat(diff - left);
    }
    default:
      return str + " ".repeat(diff);
  }
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  selectedIndex,
}: TableProps<T>) {
  // Calculate column widths
  const colWidths = columns.map((col) => {
    if (col.width) return col.width;
    const headerLen = col.header.length;
    const maxDataLen = data.reduce((max, row) => {
      const val = String(row[col.key] ?? "");
      return Math.max(max, val.length);
    }, 0);
    return Math.max(headerLen, maxDataLen) + 2;
  });

  return (
    <InkBox flexDirection="column">
      {/* Header */}
      <InkBox gap={1}>
        {columns.map((col, i) => (
          <InkBox key={col.key} width={colWidths[i]}>
            <InkText bold color="cyan">
              {pad(col.header, colWidths[i]!, col.align)}
            </InkText>
          </InkBox>
        ))}
      </InkBox>

      {/* Separator */}
      <InkBox>
        <InkText dimColor>
          {colWidths.map((w) => "─".repeat(w)).join("─")}
        </InkText>
      </InkBox>

      {/* Rows */}
      {data.map((row, rowIndex) => {
        const isSelected = rowIndex === selectedIndex;
        return (
          <InkBox key={rowIndex} gap={1}>
            {columns.map((col, colIndex) => {
              const value = row[col.key];
              const rendered = col.render
                ? col.render(value, row)
                : String(value ?? "");

              if (typeof rendered !== "string") {
                return (
                  <InkBox key={col.key} width={colWidths[colIndex]}>
                    {rendered}
                  </InkBox>
                );
              }

              return (
                <InkBox key={col.key} width={colWidths[colIndex]}>
                  <InkText
                    bold={isSelected}
                    color={isSelected ? "white" : col.color}
                  >
                    {pad(rendered, colWidths[colIndex]!, col.align)}
                  </InkText>
                </InkBox>
              );
            })}
          </InkBox>
        );
      })}

      {data.length === 0 && (
        <InkBox marginTop={1}>
          <InkText dimColor>No data</InkText>
        </InkBox>
      )}
    </InkBox>
  );
}
