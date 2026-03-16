import React from "react";
import { Box as InkBox, Text as InkText } from "ink";

export interface HelpBinding {
  key: string;
  label: string;
}

export interface HelpSection {
  title: string;
  bindings: HelpBinding[];
}

export interface HelpOverlayProps {
  screenName: string;
  sections: HelpSection[];
}

/**
 * Full-screen help overlay showing keybindings for the current screen.
 * Activated by pressing '?' from any screen.
 */
export function HelpOverlay({ screenName, sections }: HelpOverlayProps) {
  return (
    <InkBox
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
      width="100%"
    >
      <InkBox gap={1} marginBottom={1}>
        <InkText color="cyan" bold>
          ?
        </InkText>
        <InkText bold>
          Help - {screenName}
        </InkText>
      </InkBox>

      {sections.map((section) => (
        <InkBox key={section.title} flexDirection="column" marginBottom={1}>
          <InkText bold dimColor>
            {section.title}
          </InkText>
          {section.bindings.map((binding) => (
            <InkBox key={binding.key} gap={1} paddingLeft={1}>
              <InkText color="yellow" bold>
                {binding.key.padEnd(14)}
              </InkText>
              <InkText>{binding.label}</InkText>
            </InkBox>
          ))}
        </InkBox>
      ))}

      <InkBox marginTop={1}>
        <InkText dimColor>Press ? or Esc to close this help.</InkText>
      </InkBox>
    </InkBox>
  );
}

/**
 * Builds a standard set of help sections for a screen.
 * Includes the screen-specific bindings plus global bindings.
 */
export function buildHelpSections(
  screenBindings: HelpBinding[],
  screenLabel: string,
): HelpSection[] {
  return [
    {
      title: screenLabel,
      bindings: screenBindings,
    },
    {
      title: "Global",
      bindings: [
        { key: "/", label: "Open command palette" },
        { key: "?", label: "Toggle this help" },
        { key: "q / Esc", label: "Go back" },
        { key: "1", label: "Jump to dashboard" },
        { key: "N", label: "Notifications" },
      ],
    },
    {
      title: "Navigation",
      bindings: [
        { key: "j / Down", label: "Move down" },
        { key: "k / Up", label: "Move up" },
        { key: "g", label: "Go to top" },
        { key: "G", label: "Go to bottom" },
        { key: "Ctrl+d", label: "Page down" },
        { key: "Ctrl+u", label: "Page up" },
        { key: "Enter", label: "Select / Open" },
      ],
    },
  ];
}
