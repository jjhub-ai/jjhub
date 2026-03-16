#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { App } from "./App";

// Clear screen and render the TUI
const { waitUntilExit } = render(<App />, {
  // Use the full terminal
  exitOnCtrlC: true,
});

waitUntilExit().then(() => {
  process.exit(0);
});
