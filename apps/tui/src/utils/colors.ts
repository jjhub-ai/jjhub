/**
 * Consistent color theme for the TUI.
 *
 *   Green   - success / open / running
 *   Red     - error / closed / failed
 *   Yellow  - warning / suspended / pending
 *   Cyan    - info / links / navigation
 *   Magenta - agent / AI
 *   Gray    - metadata / timestamps (use dimColor)
 */

export const theme = {
  // Semantic colors
  success: "green",
  error: "red",
  warning: "yellow",
  info: "cyan",
  agent: "magenta",

  // Status mapping
  open: "green",
  closed: "red",
  merged: "cyan",
  draft: "gray",
  running: "green",
  suspended: "yellow",
  pending: "yellow",
  failed: "red",
  creating: "yellow",
  deleting: "red",
  completed: "cyan",
  cancelled: "gray",

  // UI elements
  accent: "cyan",
  border: "gray",
  borderFocused: "cyan",
  heading: "cyan",
  link: "cyan",
  muted: "gray",
} as const;

/** Map any status string to a consistent color. */
export function statusColor(status: string): string {
  const map: Record<string, string> = {
    open: theme.open,
    closed: theme.closed,
    merged: theme.merged,
    draft: theme.draft,
    running: theme.running,
    started: theme.running,
    suspended: theme.suspended,
    pending: theme.pending,
    failed: theme.failed,
    creating: theme.creating,
    deleting: theme.deleting,
    completed: theme.completed,
    cancelled: theme.cancelled,
    online: theme.success,
    syncing: theme.warning,
    offline: theme.error,
    stopped: theme.muted,
    error: theme.error,
  };
  return map[status.toLowerCase()] ?? "white";
}

/** Map issue state to color. */
export function issueStateColor(state: string): string {
  return state === "open" ? theme.open : theme.closed;
}

/** Map LR state to color. */
export function lrStateColor(state: string): string {
  switch (state) {
    case "open": return theme.open;
    case "merged": return theme.merged;
    case "closed": return theme.closed;
    case "draft": return theme.draft;
    default: return "white";
  }
}

/** Map HTTP method to color. */
export function methodColor(method: string): string {
  switch (method.toUpperCase()) {
    case "GET": return theme.success;
    case "POST": return theme.warning;
    case "PUT":
    case "PATCH": return theme.info;
    case "DELETE": return theme.error;
    default: return "white";
  }
}

/** Map diff change type to color. */
export function changeTypeColor(ct: string): string {
  switch (ct) {
    case "A": return theme.success;
    case "D": return theme.error;
    case "R": return theme.warning;
    default: return theme.info;
  }
}

/** Map label name to a fallback color. */
export function labelColor(label: string): string {
  const colors: Record<string, string> = {
    bug: theme.error,
    enhancement: theme.success,
    auth: theme.warning,
    critical: "redBright",
    cli: "blue",
    runner: theme.agent,
  };
  return colors[label] ?? "white";
}
