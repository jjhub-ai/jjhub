// @jjhub/editor-core — Shared editor integration logic for JJHub
//
// This package provides daemon management and API client logic
// shared between the Neovim plugin and VSCode extension.

// Daemon lifecycle
export {
  checkDaemonHealth,
  startDaemon,
  stopDaemon,
  waitForDaemon,
  getDaemonUrl,
  type DaemonHealthResponse,
  type StartDaemonOptions,
} from "./daemon";

// API client
export {
  EditorAPIClient,
  type EditorAPIClientOptions,
  type IssueSummary,
  type IssueDetailResponse,
  type LandingSummary,
  type BookmarkResponse,
  type RepoChange,
  type SearchResult,
  type Notification,
  type NotificationsPage,
  type SyncStatusResponse,
  type CreateIssueRequest,
  type ListOptions,
} from "./api";

// Config helpers
export {
  readConfigFile,
  parseMinimalToml,
  getToken,
  detectRepoContext,
  getDaemonUrlFromConfig,
  type JJHubConfig,
  type RepoContext,
} from "./config";

// Sync status
export {
  pollSyncStatus,
  getPendingSyncCount,
  type SyncStatus,
  type SyncStatusInfo,
} from "./sync";

// Auto-start helpers
export {
  findJJHubBinary,
  isInstalled,
  getInstallInstructions,
} from "./auto-start";
