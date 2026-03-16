#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { configureApiClient } from "@jjhub/ui-core";
import { App } from "./App";

// Configure the API client before rendering
configureApiClient({
  baseUrl: process.env.JJHUB_API_URL || "http://localhost:4000",
  getToken: () => {
    const token = process.env.JJHUB_TOKEN;
    return token ? `token ${token}` : null;
  },
});

// Parse initial repo from --repo flag or JJHUB_REPO env var
function parseInitialRepo(): { owner: string; name: string } | undefined {
  const repoArg =
    process.argv.find((a) => a.startsWith("--repo="))?.split("=")[1] ??
    (() => {
      const idx = process.argv.indexOf("--repo");
      return idx >= 0 ? process.argv[idx + 1] : undefined;
    })() ??
    process.env.JJHUB_REPO;

  if (!repoArg) return undefined;
  const parts = repoArg.split("/");
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { owner: parts[0], name: parts[1] };
  }
  return undefined;
}

const initialRepo = parseInitialRepo();

// Clear screen and render the TUI
const { waitUntilExit } = render(<App initialRepo={initialRepo} />, {
  // Use the full terminal
  exitOnCtrlC: true,
});

waitUntilExit().then(() => {
  process.exit(0);
});
