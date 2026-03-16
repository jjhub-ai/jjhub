import React, { useState, useCallback, useMemo } from "react";
import { useInput, useApp, useStdout } from "ink";
import { Box, Text, ErrorBoundary, SplashScreen, HelpOverlay, buildHelpSections } from "./primitives";
import type { HelpBinding } from "./primitives";
import {
  Dashboard,
  RepoOverview,
  IssueList,
  IssueDetail,
  IssueCreate,
  LandingList,
  LandingDetail,
  ChangeList,
  DiffViewer,
  Search,
  SyncConflicts,
  SyncStatus,
  AgentSessionList,
  AgentChat,
  WorkspaceList,
  WorkspaceDetail,
  WorkspaceCreate,
  CommandPalette,
  WikiView,
  NotificationsList,
  type CommandPaletteResult,
} from "./screens";

interface ScreenState {
  name: string;
  params: Record<string, string>;
}

export interface AppProps {
  initialRepo?: { owner: string; name: string };
}

/** Human-readable labels for screen names, used in breadcrumbs. */
const SCREEN_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  repo: "Repository",
  issues: "Issues",
  "issue-detail": "Issue",
  "issue-create": "New Issue",
  landings: "Landing Requests",
  "landing-detail": "Landing Request",
  changes: "Changes",
  diff: "Diff",
  search: "Search",
  "sync-status": "Sync Status",
  "sync-conflicts": "Sync Conflicts",
  "agent-sessions": "Agent Sessions",
  "agent-chat": "Agent Chat",
  workspaces: "Workspaces",
  "workspace-detail": "Workspace",
  "workspace-create": "New Workspace",
  wiki: "Wiki",
  "wiki-view": "Wiki Page",
  notifications: "Notifications",
};

/** Build a breadcrumb label for a screen state. */
function breadcrumbLabel(s: ScreenState): string {
  const base = SCREEN_LABELS[s.name] ?? s.name;
  // Add context like repo name, issue number
  if (s.params.owner && s.params.name && s.name === "repo") {
    return `${s.params.owner}/${s.params.name}`;
  }
  if (s.params.issueId && s.name === "issue-detail") {
    return `#${s.params.issueId}`;
  }
  if (s.params.lrId && s.name === "landing-detail") {
    return `!${s.params.lrId}`;
  }
  if (s.params.owner && s.params.name && !["dashboard", "repo"].includes(s.name)) {
    return base;
  }
  return base;
}

/** Screen-specific help bindings for the '?' overlay. */
function getScreenHelpBindings(screenName: string): HelpBinding[] {
  switch (screenName) {
    case "dashboard":
      return [
        { key: "Enter", label: "Open repository" },
        { key: "Tab", label: "Switch panel" },
        { key: "S", label: "Sync status" },
        { key: "C", label: "Sync conflicts" },
      ];
    case "repo":
      return [
        { key: "i", label: "Issues" },
        { key: "l", label: "Landing requests" },
        { key: "c", label: "Changes" },
        { key: "a", label: "Agent sessions" },
        { key: "w", label: "Workspaces" },
      ];
    case "issues":
      return [
        { key: "Enter", label: "View issue" },
        { key: "o", label: "Filter: open" },
        { key: "c", label: "Filter: closed" },
        { key: "a", label: "Filter: all" },
      ];
    case "issue-detail":
      return [
        { key: "y", label: "Copy issue URL" },
      ];
    case "landings":
      return [
        { key: "Enter", label: "View landing request" },
        { key: "o", label: "Filter: open" },
        { key: "m", label: "Filter: merged" },
        { key: "c", label: "Filter: closed" },
        { key: "a", label: "Filter: all" },
      ];
    case "landing-detail":
      return [
        { key: "d", label: "View diff" },
        { key: "y", label: "Copy LR URL" },
      ];
    case "changes":
      return [
        { key: "Enter", label: "View diff" },
      ];
    case "diff":
      return [
        { key: "n / N", label: "Next / prev file" },
        { key: "f", label: "Toggle file list" },
        { key: "s", label: "Toggle side-by-side" },
      ];
    case "agent-sessions":
      return [
        { key: "n", label: "New session" },
        { key: "d", label: "Delete session" },
        { key: "r", label: "Refresh" },
      ];
    case "agent-chat":
      return [
        { key: "Tab", label: "Toggle input/history" },
        { key: "Enter", label: "Send message" },
        { key: "i", label: "Focus input" },
      ];
    case "workspaces":
      return [
        { key: "c", label: "Create workspace" },
        { key: "s", label: "Suspend" },
        { key: "r", label: "Resume" },
        { key: "d", label: "Delete" },
      ];
    case "notifications":
      return [
        { key: "Enter", label: "Open + mark read" },
        { key: "a", label: "Mark all read" },
        { key: "u / A", label: "Filter: unread / all" },
        { key: "r", label: "Refresh" },
      ];
    case "sync-status":
      return [
        { key: "s", label: "Sync now" },
        { key: "c", label: "View conflicts" },
      ];
    case "sync-conflicts":
      return [
        { key: "r", label: "Resolve (accept server)" },
        { key: "t", label: "Retry" },
        { key: "d", label: "View details" },
      ];
    default:
      return [];
  }
}

export function App({ initialRepo }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const termWidth = stdout?.columns ?? 80;

  // Compact mode for narrow terminals
  const isCompact = termWidth < 80;

  const [showSplash, setShowSplash] = useState(true);
  const [screenStack, setScreenStack] = useState<ScreenState[]>(() => {
    const dashboard: ScreenState = { name: "dashboard", params: {} };
    if (initialRepo) {
      return [
        dashboard,
        { name: "repo", params: { owner: initialRepo.owner, name: initialRepo.name } },
      ];
    }
    return [dashboard];
  });
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const currentScreen = screenStack[screenStack.length - 1]!;

  // Derive current repo context from the screen stack
  const repoContext = useMemo(() => {
    for (let i = screenStack.length - 1; i >= 0; i--) {
      const s = screenStack[i]!;
      if (s.params.owner && s.params.name) {
        return { owner: s.params.owner, name: s.params.name };
      }
    }
    return undefined;
  }, [screenStack]);

  const navigate = useCallback(
    (screen: string, params: Record<string, string> = {}) => {
      if (screen === "__back__") {
        setScreenStack((stack) => {
          if (stack.length <= 1) return stack;
          return stack.slice(0, -1);
        });
        return;
      }
      setScreenStack((stack) => [...stack, { name: screen, params }]);
    },
    [],
  );

  const goBack = useCallback(() => {
    setScreenStack((stack) => {
      if (stack.length <= 1) return stack;
      return stack.slice(0, -1);
    });
  }, []);

  const handleCommandPaletteExecute = useCallback(
    (result: CommandPaletteResult) => {
      setShowCommandPalette(false);

      if (result.screen === "__quit__") {
        exit();
        return;
      }

      if (result.screen === "sync-now") {
        navigate("sync-status", {});
        return;
      }

      navigate(result.screen, result.params);
    },
    [exit, navigate],
  );

  const handleDismissSplash = useCallback(() => {
    setShowSplash(false);
  }, []);

  // Screens where the Input component is active and should consume keys
  const inputActiveScreens = new Set([
    "search",
    "issue-create",
    "agent-chat",
    "workspace-create",
  ]);

  // Global keybindings
  useInput(
    (input, key) => {
      if (showSplash || showCommandPalette) return;

      // '?' toggles help overlay (except in input-active screens)
      if (input === "?" && !inputActiveScreens.has(currentScreen.name)) {
        setShowHelp((v) => !v);
        return;
      }

      // When help is showing, Esc or ? closes it
      if (showHelp) {
        if (key.escape) {
          setShowHelp(false);
        }
        return; // Consume all other keys when help is open
      }

      // q to go back or quit (except in screens with text input)
      if (input === "q" && !inputActiveScreens.has(currentScreen.name)) {
        if (screenStack.length > 1) {
          goBack();
        } else {
          exit();
        }
        return;
      }

      // Escape to go back
      if (key.escape && !inputActiveScreens.has(currentScreen.name)) {
        if (screenStack.length > 1) {
          goBack();
        }
        return;
      }

      // Global '/' opens command palette (not when in input-active screens)
      if (input === "/" && !inputActiveScreens.has(currentScreen.name)) {
        setShowCommandPalette(true);
        return;
      }

      // Number shortcuts to jump to top-level screens
      if (input === "1" && !inputActiveScreens.has(currentScreen.name)) {
        setScreenStack([{ name: "dashboard", params: {} }]);
        return;
      }

      // Sync status shortcut (Shift+S)
      if (input === "S" && currentScreen.name === "dashboard") {
        navigate("sync-status");
        return;
      }

      // Conflicts shortcut (Shift+C)
      if (input === "C" && currentScreen.name === "dashboard") {
        navigate("sync-conflicts");
        return;
      }

      // Notifications shortcut (Shift+N) from any non-input screen
      if (input === "N" && !inputActiveScreens.has(currentScreen.name)) {
        navigate("notifications");
        return;
      }
    },
    { isActive: !showCommandPalette },
  );

  // Splash screen
  if (showSplash) {
    return <SplashScreen version="0.0.1" onDismiss={handleDismissSplash} />;
  }

  const { name, params } = currentScreen;

  // Build breadcrumb trail
  const breadcrumbs = screenStack.map((s) => breadcrumbLabel(s));

  // Help overlay
  if (showHelp) {
    const bindings = getScreenHelpBindings(name);
    const screenLabel = SCREEN_LABELS[name] ?? name;
    const sections = buildHelpSections(bindings, screenLabel);
    return (
      <Box flexDirection="column" height="100%">
        <HelpOverlay screenName={screenLabel} sections={sections} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      {/* Header bar with breadcrumb trail */}
      <Box paddingX={1} justifyContent="space-between">
        <Box gap={1}>
          <Text bold color="cyan">
            JJHub
          </Text>
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              <Text dimColor>&gt;</Text>
              <Text
                dimColor={i < breadcrumbs.length - 1}
                bold={i === breadcrumbs.length - 1}
              >
                {isCompact && crumb.length > 16 ? crumb.slice(0, 15) + "\u2026" : crumb}
              </Text>
            </React.Fragment>
          ))}
        </Box>
        {!isCompact && (
          <Box gap={1}>
            <Text dimColor>/ commands</Text>
            <Text dimColor>|</Text>
            <Text dimColor>? help</Text>
            <Text dimColor>|</Text>
            <Text dimColor>v0.0.1</Text>
          </Box>
        )}
      </Box>

      {/* Command palette overlay */}
      {showCommandPalette && (
        <CommandPalette
          onExecute={handleCommandPaletteExecute}
          onCancel={() => setShowCommandPalette(false)}
          repoContext={repoContext}
        />
      )}

      {/* Screen content (hidden when command palette is open) */}
      {!showCommandPalette && (
        <ErrorBoundary context={SCREEN_LABELS[name] ?? name}>
          {name === "dashboard" && <Dashboard onNavigate={navigate} />}

          {name === "repo" && (
            <RepoOverview
              owner={params.owner ?? ""}
              name={params.name ?? ""}
              onNavigate={navigate}
            />
          )}

          {name === "issues" && (
            <IssueList
              owner={params.owner ?? ""}
              name={params.name ?? ""}
              onNavigate={navigate}
            />
          )}

          {name === "issue-detail" && (
            <IssueDetail
              owner={params.owner ?? ""}
              name={params.name ?? ""}
              issueId={params.issueId ?? ""}
              onNavigate={navigate}
            />
          )}

          {name === "issue-create" && (
            <IssueCreate
              owner={params.owner ?? ""}
              name={params.name ?? ""}
              initialTitle={params.title}
              onNavigate={navigate}
            />
          )}

          {name === "landings" && (
            <LandingList
              owner={params.owner ?? ""}
              name={params.name ?? ""}
              onNavigate={navigate}
            />
          )}

          {name === "landing-detail" && (
            <LandingDetail
              owner={params.owner ?? ""}
              name={params.name ?? ""}
              lrId={params.lrId ?? ""}
              onNavigate={navigate}
            />
          )}

          {name === "changes" && (
            <ChangeList
              owner={params.owner ?? ""}
              name={params.name ?? ""}
              onNavigate={navigate}
            />
          )}

          {name === "diff" && (
            <DiffViewer
              owner={params.owner ?? ""}
              name={params.name ?? ""}
              changeId={params.changeId}
              lrNumber={params.lrNumber}
              onNavigate={navigate}
            />
          )}

          {name === "search" && <Search onNavigate={navigate} />}

          {name === "sync-status" && <SyncStatus onNavigate={navigate} />}

          {name === "sync-conflicts" && <SyncConflicts onNavigate={navigate} />}

          {name === "agent-sessions" && (
            <AgentSessionList
              owner={params.owner ?? ""}
              name={params.name ?? ""}
              onNavigate={navigate}
            />
          )}

          {name === "agent-chat" && (
            <AgentChat
              owner={params.owner ?? ""}
              name={params.name ?? ""}
              sessionId={params.sessionId}
              mode={params.mode}
              onNavigate={navigate}
            />
          )}

          {name === "workspaces" && (
            <WorkspaceList
              owner={params.owner ?? ""}
              name={params.name ?? ""}
              onNavigate={navigate}
            />
          )}

          {name === "workspace-detail" && (
            <WorkspaceDetail
              owner={params.owner ?? ""}
              name={params.name ?? ""}
              workspaceId={params.workspaceId ?? ""}
              onNavigate={navigate}
            />
          )}

          {name === "workspace-create" && (
            <WorkspaceCreate
              owner={params.owner ?? ""}
              name={params.name ?? ""}
              onNavigate={navigate}
            />
          )}

          {name === "wiki" && (
            <WikiView
              owner={params.owner ?? ""}
              name={params.name ?? ""}
              onNavigate={navigate}
            />
          )}

          {name === "wiki-view" && (
            <WikiView
              owner={params.owner ?? ""}
              name={params.name ?? ""}
              slug={params.slug}
              onNavigate={navigate}
            />
          )}

          {name === "notifications" && (
            <NotificationsList onNavigate={navigate} />
          )}
        </ErrorBoundary>
      )}
    </Box>
  );
}
