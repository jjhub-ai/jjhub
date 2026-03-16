// @jjhub/sdk — JJHub TypeScript SDK
//
// This package is the core of JJHub Community Edition.
// It provides type-safe access to all JJHub operations:
// auth, repos, issues, landings, workflows, workspaces, and more.
//
// The Hono server (apps/server) is a thin HTTP wrapper around this SDK.
// The CLI can also import this SDK directly for local operations.

// Database
export { initDb, initDbSync, getDb, closeDb, getDbMode } from "./lib/db";
export { getAuthInfoByTokenHash } from "./db/users_sql";
export {
  getAuthSessionBySessionKey,
  updateAccessTokenLastUsed,
} from "./db/auth_sql";

// Errors
export { APIError, type FieldError } from "./lib/errors";
export {
  notFound,
  badRequest,
  unauthorized,
  forbidden,
  conflict,
  internal,
  validationFailed,
  unsupportedMediaType,
  writeError,
  writeJSON,
  writeRouteError,
} from "./lib/errors";

// Blob storage
export { type BlobStore, getBlobStore, createBlobStore } from "./lib/blob";

// Context
export {
  type AuthUser,
  type AuthInfo,
  AUTH_INFO_KEY,
  USER_KEY,
  getAuthInfo,
  getUser,
} from "./lib/context";

// Pagination
export {
  parsePagination,
  cursorToPage,
  setPaginationHeaders,
  parseInt64Param,
  requireStringParam,
  repoOwnerAndName,
} from "./lib/pagination";

// Services
export { createAuthService } from "./services/auth";
export { UserService } from "./services/user";
export { RepoService } from "./services/repo";
export { IssueService } from "./services/issue";
export { LabelService } from "./services/label";
export { MilestoneService } from "./services/milestone";
export { LandingService } from "./services/landing";
export { OrgService } from "./services/org";
export { WikiService } from "./services/wiki";
export { SearchService } from "./services/search";
export { WebhookService } from "./services/webhook";
export { WorkflowService } from "./services/workflow";
export { NotificationService } from "./services/notification";
export { SecretService } from "./services/secret";
export { ReleaseService } from "./services/release";
export { OAuth2Service } from "./services/oauth2";
export { LFSService } from "./services/lfs";
export {
  RepoHostService,
  getRepoHostService,
  createRepoHostService,
} from "./services/repohost";
export type {
  Bookmark,
  CreateBookmarkRequest as RepoHostCreateBookmarkRequest,
  Change,
  ChangeDiff,
  FileDiffItem,
  ChangeFile,
  ChangeConflict,
  FileContent,
  Operation as RepoHostOperation,
} from "./services/repohost";
export { ContainerSandboxClient } from "./services/container-sandbox";
export type {
  ContainerRuntime,
  ContainerState,
  PortMapping as ContainerPortMapping,
  VolumeMount,
  CreateContainerConfig,
  CreateContainerResult,
  ContainerStatus,
  ExecResult,
  SSHConnectionInfo,
} from "./services/container-sandbox";

// Sync (local-first daemon mode)
export { SyncService, createSyncService } from "./services/sync";
export type {
  SyncStatus,
  SyncState,
  ShapeSubscription,
  SyncServiceConfig,
} from "./services/sync";
export { SyncQueue } from "./services/sync-queue";
export type {
  SyncQueueStatus,
  SyncQueueItem,
  FlushResult,
  RemoteCaller,
} from "./services/sync-queue";
