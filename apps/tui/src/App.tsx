import React, { useState, useCallback } from "react";
import { useInput, useApp } from "ink";
import { Box, Text } from "./primitives";
import {
  Dashboard,
  RepoOverview,
  IssueList,
  IssueDetail,
  LandingList,
  LandingDetail,
  ChangeList,
  DiffViewer,
  Search,
  SyncConflicts,
  SyncStatus,
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

  const currentScreen = screenStack[screenStack.length - 1]!;

  const navigate = useCallback(
    (screen: string, params: Record<string, string> = {}) => {
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

  // Global keybindings
  useInput((input, key) => {
    // q to go back or quit
    if (input === "q") {
      if (screenStack.length > 1) {
        goBack();
      } else {
        exit();
      }
      return;
    }

    // Escape to go back
    if (key.escape) {
      if (screenStack.length > 1) {
        goBack();
      }
      return;
    }

    // Global shortcuts from any screen
    if (input === "/" && currentScreen.name !== "search") {
      navigate("search");
      return;
    }

    // Number shortcuts to jump to top-level screens
    if (input === "1" && currentScreen.name !== "search") {
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
  });

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
        <Text dimColor>v0.0.1</Text>
      </Box>

      {/* Screen content */}
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
    </Box>
  );
}
