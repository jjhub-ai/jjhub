import React, { useState, useCallback } from "react";
import { useInput, useApp } from "ink";
import { Box, Text } from "./primitives";
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

export function App({ initialRepo }: AppProps) {
  const { exit } = useApp();
  const [screenStack, setScreenStack] = useState<ScreenState[]>(() => {
    if (initialRepo) {
      return [
        { name: "dashboard", params: {} },
        { name: "repo", params: { owner: initialRepo.owner, name: initialRepo.name } },
      ];
    }
    return [{ name: "dashboard", params: {} }];
  });
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  const currentScreen = screenStack[screenStack.length - 1]!;

  // Derive current repo context from the screen stack (walk backward to find a repo screen)
  const repoContext = (() => {
    for (let i = screenStack.length - 1; i >= 0; i--) {
      const s = screenStack[i]!;
      if (s.params.owner && s.params.name) {
        return { owner: s.params.owner, name: s.params.name };
      }
    }
    return undefined;
  })();

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

      // For sync-now, navigate to sync-status and trigger sync
      if (result.screen === "sync-now") {
        navigate("sync-status", {});
        return;
      }

      navigate(result.screen, result.params);
    },
    [exit, navigate],
  );

  // Screens where the Input component is active and should consume `/`
  const inputActiveScreens = new Set([
    "search",
    "issue-create",
    "agent-chat",
    "workspace-create",
  ]);

  // Global keybindings
  useInput(
    (input, key) => {
      // Don't handle keys when command palette is open
      if (showCommandPalette) return;

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

      // Global `/` opens command palette (not when in input-active screens)
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

  const { name, params } = currentScreen;

  return (
    <Box flexDirection="column" height="100%">
      {/* Header bar */}
      <Box paddingX={1} justifyContent="space-between">
        <Box gap={1}>
          <Text bold color="cyan">
            jjhub
          </Text>
          <Text dimColor>|</Text>
          {screenStack.map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && <Text dimColor>&gt;</Text>}
              <Text
                dimColor={i < screenStack.length - 1}
                bold={i === screenStack.length - 1}
              >
                {s.name}
              </Text>
            </React.Fragment>
          ))}
        </Box>
        <Box gap={1}>
          <Text dimColor>/ commands</Text>
          <Text dimColor>|</Text>
          <Text dimColor>v0.0.1</Text>
        </Box>
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
        <>
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
        </>
      )}
    </Box>
  );
}
