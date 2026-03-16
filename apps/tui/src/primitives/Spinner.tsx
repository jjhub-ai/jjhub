import React, { useState, useEffect } from "react";
import { Text as InkText } from "ink";

const SPINNER_FRAMES = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];

export interface SpinnerProps {
  label?: string;
  color?: string;
}

export function Spinner({ label, color = "cyan" }: SpinnerProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  return (
    <InkText>
      <InkText color={color}>{SPINNER_FRAMES[frame]} </InkText>
      {label && <InkText>{label}</InkText>}
    </InkText>
  );
}
