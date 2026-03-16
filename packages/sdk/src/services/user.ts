import { Result } from "better-result";
import type { Sql } from "postgres";
import crypto from "node:crypto";

import {
  getUserByID,
  getUserByLowerUsername,
  updateUser,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
} from "../db/users_sql";
import {
  listUserRepos,
  countUserRepos,
  listPublicUserRepos,
  countPublicUserRepos,
} from "../db/repos_sql";
import {
  listUserOrgs,
  countUserOrgs,
} from "../db/orgs_sql";
import {
  listUserStarredRepos,
  countUserStarredRepos,
  listPublicUserStarredRepos,
  countPublicUserStarredRepos,
} from "../db/social_sql";
import {
  listUserSSHKeys,
  createSSHKey,
  getSSHKeyByID,
  getSSHKeyByFingerprint,
  deleteSSHKey,
} from "../db/ssh_keys_sql";
import {
  listUserAccessTokens,
  createAccessToken,
  deleteAccessToken,
  listUserEmails,
  upsertEmailAddress,
  getEmailByID,
  deleteEmail,
  listUserSessions,
  deleteAuthSession,
  listUserOAuthAccounts,
  deleteOAuthAccount,
} from "../db/auth_sql";
import {
  getUserByID as getUserByIDForOwner,
} from "../db/users_sql";
import {
  getOrgByID,
} from "../db/orgs_sql";

import {
  type APIError,
  notFound,
  badRequest,
  internal,
  conflict,
  validationFailed,
  forbidden,
} from "../lib/errors";

// Types matching Go's JSON shapes — originally in routes/users.ts, inlined here
// after the services moved to @jjhub/sdk.

export interface UserProfile {
  id: number;
  username: string;
  display_name: string;
  email: string;
  bio: string;
  avatar_url: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface PublicUserProfile {
  id: number;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  created_at: string;
  updated_at: string;
}

export interface RepoSummary {
  id: number;
  owner: string;
  full_name: string;
  name: string;
  description: string;
  is_public: boolean;
  num_stars: number;
  default_bookmark: string;
  created_at: string;
  updated_at: string;
}

export interface OrgSummary {
  id: number;
  name: string;
  description: string;
  visibility: string;
  website: string;
  location: string;
}

export interface RepoListResult {
  items: RepoSummary[];
  total_count: number;
  page: number;
  per_page: number;
}

export interface OrgListResult {
  items: OrgSummary[];
  total_count: number;
  page: number;
  per_page: number;
}

export interface TokenSummary {
  id: number;
  name: string;
  token_last_eight: string;
  scopes: string[];
}

export interface CreateTokenRequest {
  name: string;
  scopes: string[];
}

export interface CreateTokenResult extends TokenSummary {
  token: string;
}

export interface SessionResponse {
  id: string;
  created_at: string;
  expires_at: string;
}

export interface EmailResponse {
  id: number;
  email: string;
  is_activated: boolean;
  is_primary: boolean;
  created_at: string;
}

export interface AddEmailRequest {
  email: string;
  is_primary: boolean;
}

export interface NotificationPreferences {
  email_notifications_enabled: boolean;
}

export interface UpdateNotificationPreferencesRequest {
  email_notifications_enabled?: boolean;
}

export interface ConnectedAccountResponse {
  id: number;
  provider: string;
  provider_user_id: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_DEFAULT_PER_PAGE = 30;
const USER_MAX_PER_PAGE = 100;
const TOKEN_PREFIX = "jjhub_";

// Valid token scopes matching Go's middleware.NormalizeTokenScope
const VALID_SCOPES = new Set([
  "all",
  "read:user",
  "write:user",
  "read:repository",
  "write:repository",
  "read:organization",
  "write:organization",
  "read:issue",
  "write:issue",
  "read:package",
  "write:package",
  "read:admin",
  "write:admin",
  "admin",
  "read:notification",
  "write:notification",
  "read:misc",
  "write:misc",
  "read:activitypub",
  "write:activitypub",
]);

const PRIVILEGED_SCOPES = new Set([
  "admin",
  "read:admin",
  "write:admin",
  "all",
]);

// ---------------------------------------------------------------------------
// Pagination helper — matches Go's normalizePagination
// ---------------------------------------------------------------------------

function normalizePagination(
  page: number,
  perPage: number
): { page: number; perPage: number } {
  if (page < 1) page = 1;
  if (perPage < 1) perPage = USER_DEFAULT_PER_PAGE;
  if (perPage > USER_MAX_PER_PAGE) perPage = USER_MAX_PER_PAGE;
  return { page, perPage };
}

// ---------------------------------------------------------------------------
// Avatar validation — matches Go's isValidAvatarURL
// ---------------------------------------------------------------------------

function isValidAvatarURL(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return u.host !== "";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Unique violation detection
// ---------------------------------------------------------------------------

function isUniqueViolation(err: unknown): boolean {
  if (!err) return false;
  const msg = String(err).toLowerCase();
  return msg.includes("duplicate key") || msg.includes("unique") || msg.includes("23505");
}

// ---------------------------------------------------------------------------
// UserService — matches Go's UserService 1:1
// ---------------------------------------------------------------------------

export class UserService {
  constructor(private readonly sql: Sql) {}

  // ---- Profile ----

  async getAuthenticatedUser(
    userID: number
  ): Promise<Result<UserProfile, APIError>> {
    const user = await getUserByID(this.sql, { id: String(userID) });
    if (!user) {
      return Result.err(notFound("user not found"));
    }
    if (!user.isActive) {
      return Result.err(notFound("user not found"));
    }
    return Result.ok(mapUserProfile(user));
  }

  async getUserByUsername(
    username: string
  ): Promise<Result<PublicUserProfile, APIError>> {
    const trimmed = username.trim();
    if (trimmed === "") {
      return Result.err(badRequest("username is required"));
    }

    const user = await getUserByLowerUsername(this.sql, {
      lowerUsername: trimmed.toLowerCase(),
    });
    if (!user) {
      return Result.err(notFound("user not found"));
    }
    return Result.ok(mapPublicUserProfile(user));
  }

  async updateAuthenticatedUser(
    userID: number,
    req: {
      display_name?: string;
      bio?: string;
      avatar_url?: string;
      email?: string;
    }
  ): Promise<Result<UserProfile, APIError>> {
    const current = await getUserByID(this.sql, { id: String(userID) });
    if (!current) {
      return Result.err(notFound("user not found"));
    }

    let displayName = current.displayName;
    if (req.display_name !== undefined) {
      displayName = req.display_name.trim();
    }

    let bio = current.bio;
    if (req.bio !== undefined) {
      bio = req.bio;
    }

    let avatarUrl = current.avatarUrl;
    if (req.avatar_url !== undefined) {
      avatarUrl = req.avatar_url.trim();
    }
    if (avatarUrl !== "" && !isValidAvatarURL(avatarUrl)) {
      return Result.err(
        validationFailed({
          resource: "User",
          field: "avatar_url",
          code: "invalid",
        })
      );
    }

    const updated = await updateUser(this.sql, {
      displayName,
      bio,
      avatarUrl,
      email: current.email,
      lowerEmail: current.lowerEmail,
      userId: String(userID),
    });
    if (!updated) {
      return Result.err(notFound("user not found"));
    }

    return Result.ok(mapUserProfile(updated));
  }

  // ---- Repos ----

  async listAuthenticatedUserRepos(
    userID: number,
    page: number,
    perPage: number
  ): Promise<Result<RepoListResult, APIError>> {
    const user = await getUserByID(this.sql, { id: String(userID) });
    if (!user) {
      return Result.err(notFound("user not found"));
    }

    const p = normalizePagination(page, perPage);
    const offset = (p.page - 1) * p.perPage;

    const totalRow = await countUserRepos(this.sql, { userId: String(userID) });
    const total = totalRow ? Number(totalRow.count) : 0;

    const repos = await listUserRepos(this.sql, {
      userId: String(userID),
      pageSize: String(p.perPage),
      pageOffset: String(offset),
    });

    const items: RepoSummary[] = repos.map((repo) =>
      mapRepoSummary(repo, user.username)
    );

    return Result.ok({
      items,
      total_count: total,
      page: p.page,
      per_page: p.perPage,
    });
  }

  async listUserReposByUsername(
    username: string,
    page: number,
    perPage: number
  ): Promise<Result<RepoListResult, APIError>> {
    const trimmed = username.trim();
    if (trimmed === "") {
      return Result.err(badRequest("username is required"));
    }

    const user = await getUserByLowerUsername(this.sql, {
      lowerUsername: trimmed.toLowerCase(),
    });
    if (!user) {
      return Result.err(notFound("user not found"));
    }

    const p = normalizePagination(page, perPage);
    const offset = (p.page - 1) * p.perPage;

    const totalRow = await countPublicUserRepos(this.sql, {
      userId: user.id,
    });
    const total = totalRow ? Number(totalRow.count) : 0;

    const repos = await listPublicUserRepos(this.sql, {
      userId: user.id,
      pageSize: String(p.perPage),
      pageOffset: String(offset),
    });

    const items: RepoSummary[] = repos.map((repo) =>
      mapRepoSummary(repo, user.username)
    );

    return Result.ok({
      items,
      total_count: total,
      page: p.page,
      per_page: p.perPage,
    });
  }

  // ---- Orgs ----

  async listAuthenticatedUserOrgs(
    userID: number,
    page: number,
    perPage: number
  ): Promise<Result<OrgListResult, APIError>> {
    const p = normalizePagination(page, perPage);
    const offset = (p.page - 1) * p.perPage;

    const totalRow = await countUserOrgs(this.sql, {
      userId: String(userID),
    });
    const total = totalRow ? Number(totalRow.count) : 0;

    const orgs = await listUserOrgs(this.sql, {
      userId: String(userID),
      pageSize: String(p.perPage),
      pageOffset: String(offset),
    });

    const items: OrgSummary[] = orgs.map((org) => ({
      id: Number(org.id),
      name: org.name,
      description: org.description,
      visibility: org.visibility,
      website: org.website,
      location: org.location,
    }));

    return Result.ok({
      items,
      total_count: total,
      page: p.page,
      per_page: p.perPage,
    });
  }

  // ---- Stars ----

  async listAuthenticatedUserStarredRepos(
    userID: number,
    page: number,
    perPage: number
  ): Promise<Result<RepoListResult, APIError>> {
    const p = normalizePagination(page, perPage);
    const offset = (p.page - 1) * p.perPage;

    const totalRow = await countUserStarredRepos(this.sql, {
      userId: String(userID),
    });
    const total = totalRow ? Number(totalRow.count) : 0;

    const repos = await listUserStarredRepos(this.sql, {
      userId: String(userID),
      pageSize: String(p.perPage),
      pageOffset: String(offset),
    });

    const items = await this.mapRepoSummariesWithResolvedOwners(repos);

    return Result.ok({
      items,
      total_count: total,
      page: p.page,
      per_page: p.perPage,
    });
  }

  async listUserStarredReposByUsername(
    username: string,
    page: number,
    perPage: number
  ): Promise<Result<RepoListResult, APIError>> {
    const trimmed = username.trim();
    if (trimmed === "") {
      return Result.err(badRequest("username is required"));
    }

    const user = await getUserByLowerUsername(this.sql, {
      lowerUsername: trimmed.toLowerCase(),
    });
    if (!user) {
      return Result.err(notFound("user not found"));
    }

    const p = normalizePagination(page, perPage);
    const offset = (p.page - 1) * p.perPage;

    const totalRow = await countPublicUserStarredRepos(this.sql, {
      userId: user.id,
    });
    const total = totalRow ? Number(totalRow.count) : 0;

    const repos = await listPublicUserStarredRepos(this.sql, {
      userId: user.id,
      pageSize: String(p.perPage),
      pageOffset: String(offset),
    });

    const items = await this.mapRepoSummariesWithResolvedOwners(repos);

    return Result.ok({
      items,
      total_count: total,
      page: p.page,
      per_page: p.perPage,
    });
  }

  // ---- Notification preferences ----

  async getNotificationPreferences(
    userID: number
  ): Promise<Result<NotificationPreferences, APIError>> {
    const row = await getUserNotificationPreferences(this.sql, {
      id: String(userID),
    });
    if (!row) {
      return Result.err(notFound("user not found"));
    }
    return Result.ok({
      email_notifications_enabled: row.emailNotificationsEnabled,
    });
  }

  async updateNotificationPreferences(
    userID: number,
    req: UpdateNotificationPreferencesRequest
  ): Promise<Result<NotificationPreferences, APIError>> {
    const current = await getUserNotificationPreferences(this.sql, {
      id: String(userID),
    });
    if (!current) {
      return Result.err(notFound("user not found"));
    }

    let emailEnabled = current.emailNotificationsEnabled;
    if (req.email_notifications_enabled !== undefined) {
      emailEnabled = req.email_notifications_enabled;
    }

    const updated = await updateUserNotificationPreferences(this.sql, {
      emailNotificationsEnabled: emailEnabled,
      userId: String(userID),
    });
    if (!updated) {
      return Result.err(internal("failed to update notification preferences"));
    }

    return Result.ok({
      email_notifications_enabled: updated.emailNotificationsEnabled,
    });
  }

  // ---- Connected accounts (OAuth) ----

  async listConnectedAccounts(
    userID: number
  ): Promise<Result<ConnectedAccountResponse[], APIError>> {
    const accounts = await listUserOAuthAccounts(this.sql, {
      userId: String(userID),
    });

    const result: ConnectedAccountResponse[] = accounts.map((a) => ({
      id: Number(a.id),
      provider: a.provider,
      provider_user_id: a.providerUserId,
      created_at: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
      updated_at: a.updatedAt instanceof Date ? a.updatedAt.toISOString() : String(a.updatedAt),
    }));

    return Result.ok(result);
  }

  async deleteConnectedAccount(
    userID: number,
    accountID: number
  ): Promise<Result<void, APIError>> {
    if (accountID <= 0) {
      return Result.err(badRequest("invalid account id"));
    }

    await deleteOAuthAccount(this.sql, {
      id: String(accountID),
      userId: String(userID),
    });

    return Result.ok(undefined);
  }

  // ---- Tokens ----

  async listTokens(
    userID: number
  ): Promise<Result<TokenSummary[], APIError>> {
    const tokens = await listUserAccessTokens(this.sql, {
      userId: String(userID),
    });

    const result: TokenSummary[] = tokens.map((t) => ({
      id: Number(t.id),
      name: t.name,
      token_last_eight: t.tokenLastEight,
      scopes: splitScopes(t.scopes),
    }));

    return Result.ok(result);
  }

  async createToken(
    userID: number,
    req: CreateTokenRequest
  ): Promise<Result<CreateTokenResult, APIError>> {
    // Validate name
    const name = req.name?.trim() ?? "";
    if (name === "") {
      return Result.err(
        validationFailed({
          resource: "AccessToken",
          field: "name",
          code: "missing_field",
        })
      );
    }

    // Validate scopes
    if (!req.scopes || req.scopes.length === 0) {
      return Result.err(
        validationFailed({
          resource: "AccessToken",
          field: "scopes",
          code: "missing_field",
        })
      );
    }

    const normalizedScopes = normalizeAndValidateScopes(req.scopes);
    if (!normalizedScopes) {
      return Result.err(
        validationFailed({
          resource: "AccessToken",
          field: "scopes",
          code: "invalid",
        })
      );
    }

    // Check privileged scopes
    if (containsPrivilegedScope(normalizedScopes)) {
      const user = await getUserByID(this.sql, { id: String(userID) });
      if (!user) {
        return Result.err(internal("failed to resolve user"));
      }
      if (!user.isAdmin) {
        return Result.err(
          forbidden("insufficient privileges for requested token scopes")
        );
      }
    }

    // Generate token
    const rawToken = TOKEN_PREFIX + randomHex(20);
    const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const tokenLastEight = hash.slice(-8);

    const created = await createAccessToken(this.sql, {
      userId: String(userID),
      name,
      tokenHash: hash,
      tokenLastEight,
      scopes: normalizedScopes.join(","),
    });
    if (!created) {
      return Result.err(internal("failed to create access token"));
    }

    return Result.ok({
      id: Number(created.id),
      name: created.name,
      token_last_eight: created.tokenLastEight,
      scopes: splitScopes(created.scopes),
      token: rawToken,
    });
  }

  async deleteToken(
    userID: number,
    tokenID: number
  ): Promise<Result<void, APIError>> {
    if (tokenID <= 0) {
      return Result.err(badRequest("invalid token id"));
    }

    await deleteAccessToken(this.sql, {
      id: String(tokenID),
      userId: String(userID),
    });

    return Result.ok(undefined);
  }

  // ---- Sessions ----

  async listSessions(
    userID: number
  ): Promise<Result<SessionResponse[], APIError>> {
    const sessions = await listUserSessions(this.sql, {
      userId: String(userID),
    });

    const result: SessionResponse[] = sessions.map((s) => ({
      id: s.sessionKey,
      created_at: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
      expires_at: s.expiresAt instanceof Date ? s.expiresAt.toISOString() : String(s.expiresAt),
    }));

    return Result.ok(result);
  }

  async revokeSession(
    userID: number,
    sessionKey: string
  ): Promise<Result<void, APIError>> {
    const trimmed = sessionKey.trim();
    if (trimmed === "") {
      return Result.err(notFound("session not found"));
    }

    // Verify the session belongs to this user
    const sessions = await listUserSessions(this.sql, {
      userId: String(userID),
    });

    const ownsSession = sessions.some((s) => s.sessionKey === trimmed);
    if (!ownsSession) {
      return Result.err(notFound("session not found"));
    }

    await deleteAuthSession(this.sql, { sessionKey: trimmed });
    return Result.ok(undefined);
  }

  // ---- Emails ----

  async listEmails(
    userID: number
  ): Promise<Result<EmailResponse[], APIError>> {
    const emails = await listUserEmails(this.sql, {
      userId: String(userID),
    });

    const result: EmailResponse[] = emails.map((e) => ({
      id: Number(e.id),
      email: e.email,
      is_activated: e.isActivated,
      is_primary: e.isPrimary,
      created_at: e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt),
    }));

    return Result.ok(result);
  }

  async addEmail(
    userID: number,
    req: AddEmailRequest
  ): Promise<Result<EmailResponse, APIError>> {
    const email = req.email?.trim() ?? "";
    if (email === "") {
      return Result.err(
        validationFailed({
          resource: "Email",
          field: "email",
          code: "missing_field",
        })
      );
    }

    // Basic email format validation
    if (!email.includes("@") || email.length < 3) {
      return Result.err(
        validationFailed({
          resource: "Email",
          field: "email",
          code: "invalid",
        })
      );
    }

    try {
      const created = await upsertEmailAddress(this.sql, {
        userId: String(userID),
        isPrimary: req.is_primary ?? false,
        email,
        lowerEmail: email.toLowerCase(),
        isActivated: false,
      });
      if (!created) {
        return Result.err(internal("failed to add email address"));
      }

      return Result.ok({
        id: Number(created.id),
        email: created.email,
        is_activated: created.isActivated,
        is_primary: created.isPrimary,
        created_at:
          created.createdAt instanceof Date
            ? created.createdAt.toISOString()
            : String(created.createdAt),
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        return Result.err(conflict("email address is already in use"));
      }
      return Result.err(internal("failed to add email address"));
    }
  }

  async deleteEmail(
    userID: number,
    emailID: number
  ): Promise<Result<void, APIError>> {
    if (emailID <= 0) {
      return Result.err(badRequest("invalid email id"));
    }

    // Verify the email belongs to the user
    const existing = await getEmailByID(this.sql, {
      id: String(emailID),
    });
    if (!existing || existing.userId !== String(userID)) {
      return Result.err(notFound("email not found"));
    }

    // Don't allow deleting primary email
    if (existing.isPrimary) {
      return Result.err(badRequest("cannot delete primary email address"));
    }

    await deleteEmail(this.sql, {
      id: String(emailID),
      userId: String(userID),
    });

    return Result.ok(undefined);
  }

  // ---- SSH Keys ----

  async listSSHKeys(
    userID: number
  ): Promise<
    Result<
      Array<{
        id: number;
        name: string;
        fingerprint: string;
        key_type: string;
        created_at: string;
      }>,
      APIError
    >
  > {
    if (userID <= 0) {
      return Result.err(badRequest("invalid user"));
    }

    const keys = await listUserSSHKeys(this.sql, {
      userId: String(userID),
    });

    const result = keys
      .filter((k) => k.userId === String(userID))
      .map((k) => ({
        id: Number(k.id),
        name: k.name,
        fingerprint: k.fingerprint,
        key_type: k.keyType,
        created_at:
          k.createdAt instanceof Date
            ? k.createdAt.toISOString()
            : String(k.createdAt),
      }));

    return Result.ok(result);
  }

  async createSSHKey(
    userID: number,
    req: { title: string; key: string }
  ): Promise<
    Result<
      {
        id: number;
        name: string;
        fingerprint: string;
        key_type: string;
        created_at: string;
      },
      APIError
    >
  > {
    if (userID <= 0) {
      return Result.err(badRequest("invalid user"));
    }

    const title = req.title?.trim() ?? "";
    if (title === "") {
      return Result.err(
        validationFailed({
          resource: "SSHKey",
          field: "title",
          code: "missing_field",
        })
      );
    }
    if (title.length > 255) {
      return Result.err(
        validationFailed({
          resource: "SSHKey",
          field: "title",
          code: "invalid",
        })
      );
    }

    const rawKey = req.key?.trim() ?? "";
    if (rawKey === "") {
      return Result.err(
        validationFailed({
          resource: "SSHKey",
          field: "key",
          code: "missing_field",
        })
      );
    }

    // Parse and validate the SSH public key
    let keyType: string;
    let fingerprint: string;
    let canonicalKey: string;

    try {
      const parsed = parseSSHPublicKey(rawKey);
      keyType = parsed.keyType;
      fingerprint = parsed.fingerprint;
      canonicalKey = parsed.canonicalKey;
    } catch {
      return Result.err(
        validationFailed({
          resource: "SSHKey",
          field: "key",
          code: "invalid",
        })
      );
    }

    // Check for duplicate fingerprint
    const existing = await getSSHKeyByFingerprint(this.sql, { fingerprint });
    if (existing) {
      return Result.err(conflict("ssh key already registered"));
    }

    try {
      const created = await createSSHKey(this.sql, {
        userId: String(userID),
        name: title,
        publicKey: canonicalKey,
        fingerprint,
        keyType,
      });
      if (!created) {
        return Result.err(internal("failed to create ssh key"));
      }

      return Result.ok({
        id: Number(created.id),
        name: created.name,
        fingerprint: created.fingerprint,
        key_type: created.keyType,
        created_at:
          created.createdAt instanceof Date
            ? created.createdAt.toISOString()
            : String(created.createdAt),
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        return Result.err(conflict("ssh key already registered"));
      }
      return Result.err(internal("failed to create ssh key"));
    }
  }

  async deleteSSHKey(
    userID: number,
    keyID: number
  ): Promise<Result<void, APIError>> {
    if (userID <= 0) {
      return Result.err(badRequest("invalid user"));
    }
    if (keyID <= 0) {
      return Result.err(badRequest("invalid ssh key id"));
    }

    // Verify the key belongs to the user
    const key = await getSSHKeyByID(this.sql, { id: String(keyID) });
    if (!key) {
      return Result.err(notFound("ssh key not found"));
    }
    if (key.userId !== String(userID)) {
      return Result.err(notFound("ssh key not found"));
    }

    await deleteSSHKey(this.sql, {
      id: String(keyID),
      userId: String(userID),
    });

    return Result.ok(undefined);
  }

  // ---- Private helpers ----

  /**
   * Resolve owner names for a list of repos that may have different owners.
   * Caches lookups to avoid repeated queries. Matches Go's mapRepoSummariesWithResolvedOwners.
   */
  private async mapRepoSummariesWithResolvedOwners(
    repos: Array<{
      id: string;
      userId: string | null;
      orgId: string | null;
      name: string;
      description: string;
      isPublic: boolean;
      numStars: string;
      defaultBookmark: string;
      createdAt: Date;
      updatedAt: Date;
    }>
  ): Promise<RepoSummary[]> {
    const userCache = new Map<string, string>();
    const orgCache = new Map<string, string>();
    const items: RepoSummary[] = [];

    for (const repo of repos) {
      let owner = "";

      if (repo.userId) {
        if (userCache.has(repo.userId)) {
          owner = userCache.get(repo.userId)!;
        } else {
          const u = await getUserByIDForOwner(this.sql, { id: repo.userId });
          if (u) {
            userCache.set(repo.userId, u.username);
            owner = u.username;
          }
        }
      } else if (repo.orgId) {
        if (orgCache.has(repo.orgId)) {
          owner = orgCache.get(repo.orgId)!;
        } else {
          const o = await getOrgByID(this.sql, { id: repo.orgId });
          if (o) {
            orgCache.set(repo.orgId, o.name);
            owner = o.name;
          }
        }
      }

      items.push(mapRepoSummary(repo, owner));
    }

    return items;
  }
}

// ---------------------------------------------------------------------------
// Mapping helpers — match Go's map* functions
// ---------------------------------------------------------------------------

function mapUserProfile(user: {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  bio: string;
  avatarUrl: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}): UserProfile {
  return {
    id: Number(user.id),
    username: user.username,
    display_name: user.displayName,
    email: user.email ?? "",
    bio: user.bio,
    avatar_url: user.avatarUrl,
    is_admin: user.isAdmin,
    created_at:
      user.createdAt instanceof Date
        ? user.createdAt.toISOString()
        : String(user.createdAt),
    updated_at:
      user.updatedAt instanceof Date
        ? user.updatedAt.toISOString()
        : String(user.updatedAt),
  };
}

function mapPublicUserProfile(user: {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  createdAt: Date;
  updatedAt: Date;
}): PublicUserProfile {
  return {
    id: Number(user.id),
    username: user.username,
    display_name: user.displayName,
    bio: user.bio,
    avatar_url: user.avatarUrl,
    created_at:
      user.createdAt instanceof Date
        ? user.createdAt.toISOString()
        : String(user.createdAt),
    updated_at:
      user.updatedAt instanceof Date
        ? user.updatedAt.toISOString()
        : String(user.updatedAt),
  };
}

function mapRepoSummary(
  repo: {
    id: string;
    name: string;
    description: string;
    isPublic: boolean;
    numStars: string;
    defaultBookmark: string;
    createdAt: Date;
    updatedAt: Date;
  },
  owner: string
): RepoSummary {
  return {
    id: Number(repo.id),
    owner,
    full_name: owner + "/" + repo.name,
    name: repo.name,
    description: repo.description,
    is_public: repo.isPublic,
    num_stars: Number(repo.numStars),
    default_bookmark: repo.defaultBookmark,
    created_at:
      repo.createdAt instanceof Date
        ? repo.createdAt.toISOString()
        : String(repo.createdAt),
    updated_at:
      repo.updatedAt instanceof Date
        ? repo.updatedAt.toISOString()
        : String(repo.updatedAt),
  };
}

// ---------------------------------------------------------------------------
// Token helpers — match Go's auth.go helpers
// ---------------------------------------------------------------------------

function splitScopes(raw: string): string[] {
  if (!raw || raw.trim() === "") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

function normalizeAndValidateScopes(scopes: string[]): string[] | null {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const rawScope of scopes) {
    const scope = rawScope.trim().toLowerCase();
    if (!VALID_SCOPES.has(scope)) {
      return null;
    }
    if (seen.has(scope)) continue;
    seen.add(scope);
    normalized.push(scope);
  }

  return normalized.length > 0 ? normalized : null;
}

function containsPrivilegedScope(scopes: string[]): boolean {
  return scopes.some((s) => PRIVILEGED_SCOPES.has(s));
}

function randomHex(bytesLen: number): string {
  return crypto.randomBytes(bytesLen).toString("hex");
}

// ---------------------------------------------------------------------------
// SSH key parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse an SSH public key from authorized_keys format.
 * Returns the key type, fingerprint, and canonical key representation.
 * This is a minimal parser for the common SSH key formats.
 */
function parseSSHPublicKey(raw: string): {
  keyType: string;
  fingerprint: string;
  canonicalKey: string;
} {
  const trimmed = raw.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) {
    throw new Error("invalid ssh key format");
  }

  const keyType = parts[0]!;
  const keyData = parts[1]!;

  // Validate that the key data is valid base64
  const keyBytes = Buffer.from(keyData, "base64");
  if (keyBytes.length === 0) {
    throw new Error("invalid ssh key data");
  }

  // Validate key type
  const validKeyTypes = [
    "ssh-rsa",
    "ssh-ed25519",
    "ecdsa-sha2-nistp256",
    "ecdsa-sha2-nistp384",
    "ecdsa-sha2-nistp521",
    "sk-ssh-ed25519@openssh.com",
    "sk-ecdsa-sha2-nistp256@openssh.com",
  ];
  if (!validKeyTypes.includes(keyType)) {
    throw new Error("unsupported key type");
  }

  // Compute SHA256 fingerprint
  const hash = crypto.createHash("sha256").update(keyBytes).digest("base64");
  // Remove trailing '=' padding to match OpenSSH format
  const fingerprint = "SHA256:" + hash.replace(/=+$/, "");

  // Canonical form is keyType + space + base64 data (no comment)
  const canonicalKey = keyType + " " + keyData;

  return { keyType, fingerprint, canonicalKey };
}
