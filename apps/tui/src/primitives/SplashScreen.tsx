import React, { useState, useEffect } from "react";
import { Box as InkBox, Text as InkText, useInput } from "ink";

export interface SplashScreenProps {
  version: string;
  onDismiss: () => void;
}

const LOGO = `
     ___  ___  _   _       _
    |_  ||_  || | | |     | |
      | |  | || |_| |_   _| |__
      | |  | ||  _  | | | | '_ \\
  /\\__/ /\\__/ /| | | | |_| | |_) |
  \\____/\\____/ \\_| |_/\\__,_|_.__/
`;

/**
 * Splash screen shown at startup.
 * Auto-dismisses after 1 second or on any keypress.
 */
export function SplashScreen({ version, onDismiss }: SplashScreenProps) {
  const [dots, setDots] = useState("");

  // Auto-dismiss after 1 second
  useEffect(() => {
    const timer = setTimeout(onDismiss, 1000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  // Dismiss on any keypress
  useInput(() => {
    onDismiss();
  });

  // Animate connection dots
  useEffect(() => {
    const timer = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 250);
    return () => clearInterval(timer);
  }, []);

  return (
    <InkBox
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      height="100%"
      width="100%"
    >
      <InkText color="cyan">{LOGO}</InkText>
      <InkBox marginTop={1} gap={1}>
        <InkText bold color="cyan">
          JJHub TUI
        </InkText>
        <InkText dimColor>v{version}</InkText>
      </InkBox>
      <InkBox marginTop={1}>
        <InkText dimColor>Connecting{dots}</InkText>
      </InkBox>
      <InkBox marginTop={2}>
        <InkText dimColor italic>
          Press any key to continue
        </InkText>
      </InkBox>
    </InkBox>
  );
}
