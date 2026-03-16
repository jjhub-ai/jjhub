/**
 * Shared command definitions for the JJHub command palette.
 *
 * These are consumed by both the web UI (SolidJS) and the TUI (Ink/React).
 * The `execute` field is intentionally omitted here because execution is
 * platform-specific (web navigates via SolidRouter, TUI pushes screens).
 * Each consumer maps commands to their own execution logic using the `id`.
 */

export type CommandCategory =
    | "navigation"
    | "action"
    | "repo"
    | "sync"
    | "workspace"
    | "agent";

export interface CommandDefinition {
    /** Unique stable identifier, e.g. "repos", "issue-new" */
    id: string;
    /** Human-readable label shown in the palette */
    label: string;
    /** Optional keyboard shortcut hint (display-only) */
    shortcut?: string;
    /** Grouping category for badge color and section headers */
    category: CommandCategory;
    /** Extra tokens for fuzzy matching beyond the label */
    keywords: string[];
    /** When true, the command only appears when a repo is in context */
    requiresRepo?: boolean;
}

/**
 * Canonical list of commands shared between the web and TUI command palettes.
 *
 * This mirrors the TUI's slash-command set so both surfaces offer
 * the exact same vocabulary.
 */
export const COMMANDS: CommandDefinition[] = [
    // ── Navigation ──────────────────────────────────────────────
    {
        id: "repos",
        label: "Go to Repositories",
        category: "navigation",
        keywords: ["repos", "list", "home", "dashboard"],
    },
    {
        id: "repo",
        label: "Open Repository...",
        category: "navigation",
        keywords: ["repo", "open", "go"],
    },
    {
        id: "search",
        label: "Search...",
        category: "navigation",
        keywords: ["search", "find", "query"],
    },
    {
        id: "notifications",
        label: "View Notifications",
        category: "navigation",
        keywords: ["notifications", "inbox", "unread"],
    },
    {
        id: "settings",
        label: "Settings",
        category: "navigation",
        keywords: ["settings", "preferences", "config"],
    },

    // ── Repo context ────────────────────────────────────────────
    {
        id: "issues",
        label: "Go to Issues",
        category: "repo",
        keywords: ["issues", "bugs", "list"],
        requiresRepo: true,
    },
    {
        id: "issue",
        label: "Go to Issue #...",
        category: "repo",
        keywords: ["issue", "number"],
        requiresRepo: true,
    },
    {
        id: "landings",
        label: "Go to Landing Requests",
        category: "repo",
        keywords: ["landings", "lr", "merge", "review"],
        requiresRepo: true,
    },
    {
        id: "changes",
        label: "Go to Changes",
        category: "repo",
        keywords: ["changes", "commits", "history"],
        requiresRepo: true,
    },
    {
        id: "diff",
        label: "View Diff...",
        category: "repo",
        keywords: ["diff", "change", "view"],
        requiresRepo: true,
    },
    {
        id: "bookmarks",
        label: "Go to Bookmarks",
        category: "repo",
        keywords: ["bookmarks", "branches"],
        requiresRepo: true,
    },
    {
        id: "wiki",
        label: "Go to Wiki",
        category: "repo",
        keywords: ["wiki", "docs", "pages"],
        requiresRepo: true,
    },
    {
        id: "labels",
        label: "Manage Labels",
        category: "repo",
        keywords: ["labels", "tags"],
        requiresRepo: true,
    },
    {
        id: "milestones",
        label: "Manage Milestones",
        category: "repo",
        keywords: ["milestones", "releases"],
        requiresRepo: true,
    },

    // ── Actions ─────────────────────────────────────────────────
    {
        id: "issue-new",
        label: "Create Issue",
        category: "action",
        keywords: ["issue", "new", "create", "bug"],
        requiresRepo: true,
    },
    {
        id: "lr-new",
        label: "Create Landing Request",
        category: "action",
        keywords: ["landing", "lr", "new", "create"],
        requiresRepo: true,
    },
    {
        id: "workspace-create",
        label: "Create Workspace",
        category: "action",
        keywords: ["workspace", "create", "new"],
        requiresRepo: true,
    },
    {
        id: "workspace-ssh",
        label: "SSH into Workspace",
        category: "action",
        keywords: ["workspace", "ssh", "terminal"],
        requiresRepo: true,
    },
    {
        id: "sync-now",
        label: "Sync Now",
        category: "action",
        keywords: ["sync", "push", "pull", "force"],
    },
    {
        id: "agent-new",
        label: "New Agent Session",
        category: "action",
        keywords: ["agent", "new", "chat", "ai"],
        requiresRepo: true,
    },

    // ── Sync ────────────────────────────────────────────────────
    {
        id: "sync",
        label: "Sync Status",
        category: "sync",
        keywords: ["sync", "status", "online", "offline"],
    },
    {
        id: "conflicts",
        label: "View Sync Conflicts",
        category: "sync",
        keywords: ["conflicts", "resolve"],
    },
    {
        id: "health",
        label: "API Health Check",
        category: "sync",
        keywords: ["health", "status", "api"],
    },

    // ── Workspace ───────────────────────────────────────────────
    {
        id: "workspace",
        label: "Workspace Status",
        category: "workspace",
        keywords: ["workspace", "dev", "environment"],
        requiresRepo: true,
    },

    // ── Agent ───────────────────────────────────────────────────
    {
        id: "agent",
        label: "Agent Sessions",
        category: "agent",
        keywords: ["agent", "ai", "chat"],
        requiresRepo: true,
    },
];

/**
 * Map from category to a display-friendly color name.
 * Consumers translate these to their own color systems
 * (CSS vars for web, ANSI for TUI).
 */
export const CATEGORY_COLORS: Record<CommandCategory, string> = {
    navigation: "blue",
    action: "purple",
    repo: "green",
    sync: "yellow",
    workspace: "cyan",
    agent: "orange",
};

/**
 * Map from category to a human-readable label for section headers.
 */
export const CATEGORY_LABELS: Record<CommandCategory, string> = {
    navigation: "Navigation",
    action: "Actions",
    repo: "Repository",
    sync: "Sync",
    workspace: "Workspace",
    agent: "Agent",
};

/**
 * Filter the canonical command list based on whether a repo is in context.
 */
export function getAvailableCommands(hasRepoContext: boolean): CommandDefinition[] {
    return COMMANDS.filter((cmd) => !cmd.requiresRepo || hasRepoContext);
}
