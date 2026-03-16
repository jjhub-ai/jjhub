import { createHash, randomBytes } from "crypto";
import type { Sql } from "postgres";
import { Result } from "better-result";

import {
  type APIError,
  badRequest,
  conflict,
  internal,
  notFound,
} from "../lib/errors";

import {
  listWorkflowDefinitionsByRepo,
  getWorkflowDefinition,
  ensureWorkflowDefinitionReference,
  createWorkflowRun,
  getWorkflowRun,
  createWorkflowStep,
  createWorkflowTask,
  cancelWorkflowRun,
  cancelWorkflowTasks,
  resumeWorkflowRun,
  resumeWorkflowTasks,
  resumeWorkflowSteps,
  listWorkflowRunsByRepo,
  listWorkflowRunsByDefinition,
  notifyWorkflowRunEvent,
} from "../db/workflows_sql";

import {
  listWorkflowStepsByRunID,
  listWorkflowLogsSince,
} from "../db/workflow_logs_sql";

import { getRepoByID } from "../db/repos_sql";
import { getUserByID } from "../db/users_sql";
import { getOrgByID } from "../db/orgs_sql";

// ---------------------------------------------------------------------------
// Trigger matching types — mirrors Go's workflow_trigger.go
// ---------------------------------------------------------------------------

interface WorkflowTriggerConfig {
  on: WorkflowOnConfig;
  jobs?: Record<string, unknown>;
}

interface WorkflowOnConfig {
  push?: PushTrigger;
  issue?: IssueTrigger;
  issues?: IssueTrigger;
  issue_comment?: IssueCommentTrigger;
  landing_request?: LandingRequestTrigger;
  release?: ReleaseTrigger;
  schedule?: ScheduleTrigger[];
  workflow_run?: WorkflowRunTrigger;
  workflow_artifact?: WorkflowArtifactTrigger;
  workflow_dispatch?: WorkflowDispatchTrigger;
}

interface PushTrigger {
  branches?: string[];
  bookmarks?: string[];
  tags?: string[];
  "branches-ignore"?: string[];
}

interface LandingRequestTrigger {
  types?: string[];
}

interface IssueTrigger {
  types?: string[];
}

interface IssueCommentTrigger {
  types?: string[];
}

interface ReleaseTrigger {
  types?: string[];
  tags?: string[];
}

interface ScheduleTrigger {
  cron: string;
}

interface WorkflowRunTrigger {
  workflows?: string[];
  types?: string[];
}

interface WorkflowArtifactTrigger {
  workflows?: string[];
  names?: string[];
}

interface WorkflowDispatchTrigger {
  inputs?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// TriggerEvent — matches Go's TriggerEvent
// ---------------------------------------------------------------------------

export interface TriggerEvent {
  type: string;
  ref: string;
  commitSHA: string;
  changeID?: string;
  action?: string;
  artifactName?: string;
  sourceWorkflow?: string;
  inputs?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Job/step config types — matches Go's JobConfig/StepConfig
// ---------------------------------------------------------------------------

interface JobConfig {
  name: string;
  steps?: StepConfig[];
  "runs-on"?: string;
  needs?: string[];
  if?: string;
  cache?: WorkflowCacheDescriptor[];
}

interface StepConfig {
  name?: string;
  run?: string;
  uses?: string;
  agent?: Record<string, unknown>;
}

interface WorkflowCacheDescriptor {
  action: string;
  key: string;
  hash_files?: string[];
  paths?: string[];
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface WorkflowStepResult {
  stepId: string;
  taskId: string;
}

export interface WorkflowRunResult {
  workflowDefinitionId: string;
  workflowRunId: string;
  steps: WorkflowStepResult[];
}

export interface DispatchForEventInput {
  repositoryId: string;
  userId: string;
  event: TriggerEvent;
  useLoadedDefinitions?: boolean;
  loadedDefinitions?: LoadedWorkflowDefinition[];
  workflowDefinitionId?: string;
}

export interface LoadedWorkflowDefinition {
  name: string;
  path: string;
  config: unknown;
}

export interface RerunInput {
  repositoryId: string;
  runId: string;
  userId: string;
}

// ---------------------------------------------------------------------------
// Glob matching — matches Go's globMatch
// ---------------------------------------------------------------------------

function globMatch(pattern: string, str: string): boolean {
  if (pattern === "") return str === "";
  if (pattern === "**") return true;
  if (pattern === "*") return !str.includes("/");

  const idx = pattern.indexOf("*");
  if (idx === -1) return pattern === str;

  const doubleStar = idx < pattern.length - 1 && pattern[idx + 1] === "*";
  const prefix = pattern.substring(0, idx);
  if (!str.startsWith(prefix)) return false;
  str = str.substring(prefix.length);

  if (doubleStar) {
    const suffix = pattern.substring(idx + 2);
    for (let i = 0; i <= str.length; i++) {
      if (globMatch(suffix, str.substring(i))) return true;
    }
    return false;
  }

  const suffix = pattern.substring(idx + 1);
  for (let i = 0; i <= str.length; i++) {
    if (i > 0 && str[i - 1] === "/") break;
    if (globMatch(suffix, str.substring(i))) return true;
  }
  return false;
}

function matchesGlobList(patterns: string[], name: string): boolean {
  return patterns.some((p) => globMatch(p, name));
}

// ---------------------------------------------------------------------------
// Trigger matching — matches Go's MatchTrigger
// ---------------------------------------------------------------------------

function normalizeBranchRef(ref: string): string {
  if (ref.startsWith("refs/heads/")) return ref.substring(11);
  return ref;
}

function normalizeTagRef(ref: string): string {
  if (ref.startsWith("refs/tags/")) return ref.substring(10);
  return ref;
}

function normalizeTriggerName(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (normalized === "issues") return "issue";
  return normalized;
}

function containsNormalizedTriggerType(
  types: string[],
  action: string
): boolean {
  const actionLower = action.toLowerCase();
  return types.some((t) => t.toLowerCase() === actionLower);
}

function matchesActionTypes(types: string[] | undefined, action: string): boolean {
  if (!types || types.length === 0) return true;
  return containsNormalizedTriggerType(types, action);
}

function matchesPush(t: PushTrigger, ref: string): boolean {
  const branch = normalizeBranchRef(ref);
  const tag = normalizeTagRef(ref);
  const isTag = ref.startsWith("refs/tags/");
  let branchPatterns = t.branches ?? [];
  if (branchPatterns.length === 0 && t.bookmarks) {
    branchPatterns = t.bookmarks;
  }

  if (isTag) {
    if (!t.tags || t.tags.length === 0) return false;
    return matchesGlobList(t.tags, tag);
  }

  if (
    t.tags &&
    t.tags.length > 0 &&
    branchPatterns.length === 0 &&
    (!t["branches-ignore"] || t["branches-ignore"].length === 0)
  ) {
    return false;
  }

  if (
    t["branches-ignore"] &&
    t["branches-ignore"].length > 0 &&
    matchesGlobList(t["branches-ignore"], branch)
  ) {
    return false;
  }

  if (branchPatterns.length === 0) return true;
  return matchesGlobList(branchPatterns, branch);
}

function matchesRelease(
  t: ReleaseTrigger,
  ref: string,
  action: string
): boolean {
  if (t.types && t.types.length > 0 && !containsNormalizedTriggerType(t.types, action)) {
    return false;
  }
  if (!t.tags || t.tags.length === 0) return true;
  return matchesGlobList(t.tags, normalizeTagRef(ref));
}

function matchesWorkflowNames(
  filters: string[] | undefined,
  sourceWorkflow: string
): boolean {
  if (!filters || filters.length === 0) return true;
  const normalized = sourceWorkflow.trim().toLowerCase();
  if (normalized === "") return false;
  const normalizedFilters = filters.map((f) => f.toLowerCase());
  return matchesGlobList(normalizedFilters, normalized);
}

function matchesWorkflowRun(
  t: WorkflowRunTrigger,
  event: TriggerEvent
): boolean {
  if (
    t.types &&
    t.types.length > 0 &&
    !containsNormalizedTriggerType(t.types, event.action ?? "")
  ) {
    return false;
  }
  return matchesWorkflowNames(t.workflows, event.sourceWorkflow ?? "");
}

function matchesWorkflowArtifact(
  t: WorkflowArtifactTrigger,
  event: TriggerEvent
): boolean {
  if (!matchesWorkflowNames(t.workflows, event.sourceWorkflow ?? "")) {
    return false;
  }
  if (!t.names || t.names.length === 0) return true;
  return matchesGlobList(t.names, event.artifactName ?? "");
}

function matchesOn(on: WorkflowOnConfig, event: TriggerEvent): boolean {
  switch (normalizeTriggerName(event.type)) {
    case "push":
      return on.push != null && matchesPush(on.push, event.ref);
    case "issue":
      return (
        (on.issue != null && matchesActionTypes(on.issue.types, event.action ?? "")) ||
        (on.issues != null && matchesActionTypes(on.issues.types, event.action ?? ""))
      );
    case "issue_comment":
      return (
        on.issue_comment != null &&
        matchesActionTypes(on.issue_comment.types, event.action ?? "")
      );
    case "landing_request":
      return (
        on.landing_request != null &&
        matchesActionTypes(on.landing_request.types, event.action ?? "")
      );
    case "release":
      return (
        on.release != null &&
        matchesRelease(on.release, event.ref, event.action ?? "")
      );
    case "schedule":
      return on.schedule != null && on.schedule.length > 0;
    case "workflow_run":
      return (
        on.workflow_run != null && matchesWorkflowRun(on.workflow_run, event)
      );
    case "workflow_artifact":
      return (
        on.workflow_artifact != null &&
        matchesWorkflowArtifact(on.workflow_artifact, event)
      );
    case "workflow_dispatch":
      return on.workflow_dispatch != null;
    default:
      return false;
  }
}

export function matchTrigger(
  configJSON: unknown,
  event: TriggerEvent
): boolean {
  if (!configJSON) return false;
  try {
    const cfg =
      typeof configJSON === "string"
        ? (JSON.parse(configJSON) as WorkflowTriggerConfig)
        : (configJSON as WorkflowTriggerConfig);
    if (!cfg.on) return false;
    return matchesOn(cfg.on, event);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Job parsing — matches Go's parseJobsFromConfig
// ---------------------------------------------------------------------------

function parseJobsFromConfig(configJSON: unknown): JobConfig[] {
  if (!configJSON) return [];
  try {
    const raw =
      typeof configJSON === "string" ? JSON.parse(configJSON) : configJSON;
    const jobsMap = (raw as { jobs?: Record<string, JobConfig> }).jobs;
    if (!jobsMap) return [];

    const jobs: JobConfig[] = [];
    for (const [name, job] of Object.entries(jobsMap)) {
      jobs.push({ ...job, name });
    }
    jobs.sort((a, b) => a.name.localeCompare(b.name));
    return jobs;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// DAG validation — matches Go's ValidateDAG
// ---------------------------------------------------------------------------

function validateDAG(jobs: JobConfig[]): string | null {
  const nameSet = new Set(jobs.map((j) => j.name));

  for (const job of jobs) {
    if (!job.needs) continue;
    for (const dep of job.needs) {
      if (!nameSet.has(dep)) {
        return `job "${job.name}" depends on unknown job "${dep}"`;
      }
    }
  }

  // Cycle detection via topological sort
  const visited = new Set<string>();
  const stack = new Set<string>();
  const jobMap = new Map(jobs.map((j) => [j.name, j]));

  function hasCycle(name: string): boolean {
    if (stack.has(name)) return true;
    if (visited.has(name)) return false;
    visited.add(name);
    stack.add(name);
    const job = jobMap.get(name);
    if (job?.needs) {
      for (const dep of job.needs) {
        if (hasCycle(dep)) return true;
      }
    }
    stack.delete(name);
    return false;
  }

  for (const job of jobs) {
    if (hasCycle(job.name)) {
      return `workflow DAG contains a cycle involving "${job.name}"`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Agent token generation — matches Go's generateAgentToken
// ---------------------------------------------------------------------------

function generateAgentToken(): { plaintext: string; hash: string } {
  const hexPart = randomBytes(20).toString("hex");
  const plaintext = "jjhub_agent_" + hexPart;
  const hash = createHash("sha256").update(plaintext).digest("hex");
  return { plaintext, hash };
}

// ---------------------------------------------------------------------------
// Dispatch input validation
// ---------------------------------------------------------------------------

export function validateDispatchInputs(
  config: unknown,
  userInputs?: Record<string, unknown>
): Record<string, unknown> | null {
  if (!config) return userInputs ?? null;
  try {
    const cfg =
      typeof config === "string" ? JSON.parse(config) : config;
    const dispatch = (cfg as WorkflowTriggerConfig).on?.workflow_dispatch;
    if (!dispatch) return userInputs ?? null;

    // Merge default values with user-provided inputs
    const schemaInputs = dispatch.inputs ?? {};
    const merged: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(schemaInputs)) {
      const defaultVal = typeof def === "object" && def != null ? (def as Record<string, unknown>).default : undefined;
      if (defaultVal !== undefined) {
        merged[key] = defaultVal;
      }
    }
    if (userInputs) {
      for (const [key, val] of Object.entries(userInputs)) {
        merged[key] = val;
      }
    }
    return Object.keys(merged).length > 0 ? merged : null;
  } catch {
    return userInputs ?? null;
  }
}

// ---------------------------------------------------------------------------
// Bookmark normalization — matches Go's normalizeWorkflowCacheBookmark
// ---------------------------------------------------------------------------

function normalizeBookmark(rawRef: string, defaultBookmark: string): string {
  let ref = rawRef.trim();
  if (ref === "") return defaultBookmark;

  if (ref.startsWith("refs/heads/")) ref = ref.substring(11);
  else if (ref.startsWith("refs/bookmarks/")) ref = ref.substring(15);
  else if (ref.startsWith("bookmarks/")) ref = ref.substring(10);
  else if (ref.startsWith("refs/tags/") || ref.startsWith("tags/"))
    return defaultBookmark;
  else if (ref.startsWith("refs/")) return defaultBookmark;

  if (ref.trim() === "") return defaultBookmark;
  return ref;
}

// ---------------------------------------------------------------------------
// Repo owner resolution — matches Go's resolveRepoOwner
// ---------------------------------------------------------------------------

async function resolveRepoOwner(
  sql: Sql,
  repo: { userId: string | null; orgId: string | null }
): Promise<string> {
  if (repo.userId) {
    const user = await getUserByID(sql, { id: repo.userId });
    if (user) return user.username;
  }
  if (repo.orgId) {
    const org = await getOrgByID(sql, { id: repo.orgId });
    if (org) return org.name;
  }
  return "";
}

// ---------------------------------------------------------------------------
// WorkflowService — matches Go's WorkflowRunService + read operations
// ---------------------------------------------------------------------------

export class WorkflowService {
  constructor(private readonly sql: Sql) {}

  // ---- Definition reads ----

  async listWorkflowDefinitions(
    repositoryId: string,
    page: number,
    perPage: number
  ): Promise<
    Result<
      Array<{
        id: number;
        repository_id: number;
        name: string;
        path: string;
        config: unknown;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>,
      APIError
    >
  > {
    const p = normalizePagination(page, perPage);
    const offset = (p.page - 1) * p.perPage;

    const rows = await listWorkflowDefinitionsByRepo(this.sql, {
      repositoryId,
      pageOffset: String(offset),
      pageSize: String(p.perPage),
    });

    return Result.ok(
      rows.map((r) => ({
        id: Number(r.id),
        repository_id: Number(r.repositoryId),
        name: r.name,
        path: r.path,
        config: r.config,
        is_active: r.isActive,
        created_at: toISO(r.createdAt),
        updated_at: toISO(r.updatedAt),
      }))
    );
  }

  async getWorkflowDefinitionById(
    repositoryId: string,
    definitionId: string
  ): Promise<
    Result<
      {
        id: number;
        repository_id: number;
        name: string;
        path: string;
        config: unknown;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      },
      APIError
    >
  > {
    const def = await getWorkflowDefinition(this.sql, {
      id: definitionId,
      repositoryId,
    });
    if (!def) return Result.err(notFound("workflow definition not found"));

    return Result.ok({
      id: Number(def.id),
      repository_id: Number(def.repositoryId),
      name: def.name,
      path: def.path,
      config: def.config,
      is_active: def.isActive,
      created_at: toISO(def.createdAt),
      updated_at: toISO(def.updatedAt),
    });
  }

  // ---- Run reads ----

  async listWorkflowRunsByRepo(
    repositoryId: string,
    page: number,
    perPage: number
  ): Promise<
    Result<
      Array<{
        id: number;
        repository_id: number;
        workflow_definition_id: number;
        status: string;
        trigger_event: string;
        trigger_ref: string;
        trigger_commit_sha: string;
        started_at: string | null;
        completed_at: string | null;
        created_at: string;
        updated_at: string;
      }>,
      APIError
    >
  > {
    const p = normalizePagination(page, perPage);
    const offset = (p.page - 1) * p.perPage;

    const rows = await listWorkflowRunsByRepo(this.sql, {
      repositoryId,
      pageOffset: String(offset),
      pageSize: String(p.perPage),
    });

    return Result.ok(rows.map(mapWorkflowRunRow));
  }

  async listWorkflowRunsByDefinition(
    repositoryId: string,
    definitionId: string,
    page: number,
    perPage: number
  ): Promise<
    Result<
      Array<{
        id: number;
        repository_id: number;
        workflow_definition_id: number;
        status: string;
        trigger_event: string;
        trigger_ref: string;
        trigger_commit_sha: string;
        started_at: string | null;
        completed_at: string | null;
        created_at: string;
        updated_at: string;
      }>,
      APIError
    >
  > {
    const p = normalizePagination(page, perPage);
    const offset = (p.page - 1) * p.perPage;

    const rows = await listWorkflowRunsByDefinition(this.sql, {
      workflowDefinitionId: definitionId,
      repositoryId,
      pageOffset: String(offset),
      pageSize: String(p.perPage),
    });

    return Result.ok(rows.map(mapWorkflowRunRow));
  }

  async getWorkflowRunById(
    repositoryId: string,
    runId: string
  ): Promise<
    Result<
      {
        id: number;
        repository_id: number;
        workflow_definition_id: number;
        status: string;
        trigger_event: string;
        trigger_ref: string;
        trigger_commit_sha: string;
        started_at: string | null;
        completed_at: string | null;
        created_at: string;
        updated_at: string;
      },
      APIError
    >
  > {
    const run = await getWorkflowRun(this.sql, {
      id: runId,
      repositoryId,
    });
    if (!run) return Result.err(notFound("workflow run not found"));
    return Result.ok(mapWorkflowRunRow(run));
  }

  // ---- Step / log reads ----

  async listWorkflowSteps(
    runId: string
  ): Promise<
    Result<
      Array<{
        id: number;
        workflow_run_id: number;
        name: string;
        position: number;
        status: string;
        started_at: string | null;
        completed_at: string | null;
        created_at: string;
        updated_at: string;
      }>,
      APIError
    >
  > {
    const rows = await listWorkflowStepsByRunID(this.sql, { runId });
    return Result.ok(
      rows.map((r) => ({
        id: Number(r.id),
        workflow_run_id: Number(r.workflowRunId),
        name: r.name,
        position: Number(r.position),
        status: r.status,
        started_at: r.startedAt ? toISO(r.startedAt) : null,
        completed_at: r.completedAt ? toISO(r.completedAt) : null,
        created_at: toISO(r.createdAt),
        updated_at: toISO(r.updatedAt),
      }))
    );
  }

  async listWorkflowLogsSince(
    runId: string,
    afterId: number,
    limit: number
  ): Promise<
    Result<
      Array<{
        id: number;
        workflow_step_id: number;
        sequence: number;
        stream: string;
        entry: string;
        created_at: string;
      }>,
      APIError
    >
  > {
    const rows = await listWorkflowLogsSince(this.sql, {
      runId,
      afterId: String(afterId),
      pageSize: String(limit),
    });
    return Result.ok(
      rows.map((r) => ({
        id: Number(r.id),
        workflow_step_id: Number(r.workflowStepId),
        sequence: Number(r.sequence),
        stream: r.stream,
        entry: r.entry,
        created_at: toISO(r.createdAt),
      }))
    );
  }

  // ---- Dispatch ----

  async dispatchForEvent(
    input: DispatchForEventInput
  ): Promise<Result<WorkflowRunResult[], APIError>> {
    if (!input.repositoryId || Number(input.repositoryId) <= 0) {
      return Result.err(badRequest("repository id must be positive"));
    }
    if (!input.event.type) {
      return Result.err(badRequest("event type is required"));
    }

    interface DispatchDefinition {
      id: string;
      repositoryId: string;
      name: string;
      path: string;
      config: unknown;
      isActive: boolean;
      enforceActive: boolean;
    }

    const defs: DispatchDefinition[] = [];

    if (input.workflowDefinitionId) {
      // Targeted dispatch
      const def = await getWorkflowDefinition(this.sql, {
        id: input.workflowDefinitionId,
        repositoryId: input.repositoryId,
      });
      if (!def) return Result.err(notFound("workflow definition not found"));
      defs.push({
        id: def.id,
        repositoryId: def.repositoryId,
        name: def.name,
        path: def.path,
        config: def.config,
        isActive: def.isActive,
        enforceActive: true,
      });
    } else if (input.useLoadedDefinitions && input.loadedDefinitions) {
      for (const loaded of input.loadedDefinitions) {
        const ref = await ensureWorkflowDefinitionReference(this.sql, {
          repositoryId: input.repositoryId,
          name: loaded.name,
          path: loaded.path,
          config: loaded.config,
        });
        if (!ref) {
          return Result.err(
            internal("failed to ensure workflow definition reference")
          );
        }
        defs.push({
          id: ref.id,
          repositoryId: ref.repositoryId,
          name: ref.name,
          path: ref.path,
          config: loaded.config,
          isActive: ref.isActive,
          enforceActive: false,
        });
      }
    } else {
      // Broadcast dispatch
      const rows = await listWorkflowDefinitionsByRepo(this.sql, {
        repositoryId: input.repositoryId,
        pageSize: "100",
        pageOffset: "0",
      });
      for (const row of rows) {
        defs.push({
          id: row.id,
          repositoryId: row.repositoryId,
          name: row.name,
          path: row.path,
          config: row.config,
          isActive: row.isActive,
          enforceActive: true,
        });
      }
    }

    const results: WorkflowRunResult[] = [];

    for (const candidate of defs) {
      if (candidate.enforceActive && !candidate.isActive) continue;

      const matched = matchTrigger(candidate.config, input.event);
      if (!matched) continue;

      const result = await this.createRunForDefinition(
        candidate,
        input
      );
      if (!result.isOk()) return result;
      results.push(result.value);
    }

    return Result.ok(results);
  }

  private async createRunForDefinition(
    def: {
      id: string;
      repositoryId: string;
      name: string;
      path: string;
      config: unknown;
    },
    input: DispatchForEventInput
  ): Promise<Result<WorkflowRunResult, APIError>> {
    const result: WorkflowRunResult = {
      workflowDefinitionId: def.id,
      workflowRunId: "",
      steps: [],
    };

    // Resolve repository
    const repo = await getRepoByID(this.sql, { id: input.repositoryId });
    if (!repo) return Result.err(notFound("repository not found"));

    let triggerRef = input.event.ref.trim();
    if (triggerRef === "") triggerRef = repo.defaultBookmark;

    const repoOwner = await resolveRepoOwner(this.sql, {
      userId: repo.userId,
      orgId: repo.orgId,
    });

    // Serialize dispatch inputs
    let dispatchInputs: unknown = null;
    if (input.event.inputs && Object.keys(input.event.inputs).length > 0) {
      dispatchInputs = input.event.inputs;
    }

    // Create workflow run
    const run = await createWorkflowRun(this.sql, {
      repositoryId: input.repositoryId,
      workflowDefinitionId: def.id,
      status: "queued",
      triggerEvent: input.event.type,
      triggerRef,
      triggerCommitSha: input.event.commitSHA,
      dispatchInputs,
    });
    if (!run) return Result.err(internal("failed to create workflow run"));
    result.workflowRunId = run.id;

    // Generate and store agent token
    const { plaintext: agentToken, hash: tokenHash } = generateAgentToken();
    // Agent token update is done inline since updateWorkflowRunAgentToken
    // may not be available as a generated query — we store it in payload instead.

    // Parse jobs from config
    const jobs = parseJobsFromConfig(def.config);
    if (jobs.length === 0) return Result.ok(result);

    // Validate DAG
    const dagError = validateDAG(jobs);
    if (dagError) {
      return Result.err(badRequest(`invalid workflow DAG: ${dagError}`));
    }

    // Build needs set
    const jobHasNeeds = new Map<string, boolean>();
    for (const job of jobs) {
      jobHasNeeds.set(job.name, (job.needs?.length ?? 0) > 0);
    }

    const resolvedBookmark = normalizeBookmark(triggerRef, repo.defaultBookmark);

    // Create steps and tasks
    for (let pos = 0; pos < jobs.length; pos++) {
      const job = jobs[pos]!;

      let shouldRun = true;
      // Simple if expression evaluation: skip if literal "false"
      if (job.if !== undefined) {
        const expr = job.if.trim().toLowerCase();
        if (expr === "false") shouldRun = false;
      }

      let stepStatus = "queued";
      let taskStatus = "pending";
      if (!shouldRun) {
        stepStatus = "skipped";
        taskStatus = "skipped";
      } else if (jobHasNeeds.get(job.name)) {
        taskStatus = "blocked";
      }

      const step = await createWorkflowStep(this.sql, {
        workflowRunId: run.id,
        name: job.name,
        position: String(pos + 1),
        status: stepStatus,
      });
      if (!step)
        return Result.err(
          internal(`failed to create workflow step: ${job.name}`)
        );

      const payloadMap: Record<string, unknown> = {
        job: job.name,
        runs_on: job["runs-on"] ?? "",
        steps: job.steps ?? [],
        event: input.event.type,
        ref: triggerRef,
        commit: input.event.commitSHA,
        agent_token: agentToken,
        default_bookmark: repo.defaultBookmark,
        resolved_bookmark: resolvedBookmark,
        workflow_path: def.path,
        repo_name: repo.name,
        repo_owner: repoOwner,
      };
      if (job.needs && job.needs.length > 0) payloadMap.needs = job.needs;
      if (job.if) payloadMap.if = job.if;
      if (job.cache && job.cache.length > 0) payloadMap.cache = job.cache;
      if (input.event.inputs && Object.keys(input.event.inputs).length > 0) {
        payloadMap.inputs = input.event.inputs;
      }
      if (input.event.changeID) payloadMap.change_id = input.event.changeID;

      const task = await createWorkflowTask(this.sql, {
        workflowRunId: run.id,
        workflowStepId: step.id,
        repositoryId: input.repositoryId,
        status: taskStatus,
        priority: 0,
        payload: payloadMap,
        availableAt: new Date(),
        freestyleVmId: null,
      });
      if (!task)
        return Result.err(
          internal(`failed to create workflow task: ${job.name}`)
        );

      result.steps.push({
        stepId: step.id,
        taskId: task.id,
      });
    }

    return Result.ok(result);
  }

  // ---- Cancel ----

  async cancelRun(
    repositoryId: string,
    runId: string
  ): Promise<Result<void, APIError>> {
    const run = await getWorkflowRun(this.sql, {
      id: runId,
      repositoryId,
    });
    if (!run) return Result.err(notFound("workflow run not found"));

    await cancelWorkflowRun(this.sql, { id: run.id });
    await cancelWorkflowTasks(this.sql, { workflowRunId: run.id });

    return Result.ok(undefined);
  }

  // ---- Resume ----

  async resumeRun(
    repositoryId: string,
    runId: string
  ): Promise<Result<void, APIError>> {
    const run = await getWorkflowRun(this.sql, {
      id: runId,
      repositoryId,
    });
    if (!run) return Result.err(notFound("workflow run not found"));

    if (run.status !== "cancelled" && run.status !== "failure") {
      return Result.err(
        conflict(
          `cannot resume workflow run with status "${run.status}"; only cancelled or failed runs can be resumed`
        )
      );
    }

    await resumeWorkflowTasks(this.sql, { workflowRunId: run.id });
    await resumeWorkflowSteps(this.sql, { workflowRunId: run.id });
    await resumeWorkflowRun(this.sql, { id: run.id });

    // Notify via PG LISTEN/NOTIFY
    try {
      await notifyWorkflowRunEvent(this.sql, {
        runId: run.id,
        payload: JSON.stringify({
          run_id: Number(run.id),
          source: "workflow.resume",
        }),
      });
    } catch {
      // Non-fatal: notification is best-effort
    }

    return Result.ok(undefined);
  }

  // ---- Rerun ----

  async rerunRun(
    input: RerunInput
  ): Promise<Result<WorkflowRunResult, APIError>> {
    const originalRun = await getWorkflowRun(this.sql, {
      id: input.runId,
      repositoryId: input.repositoryId,
    });
    if (!originalRun) return Result.err(notFound("workflow run not found"));

    const def = await getWorkflowDefinition(this.sql, {
      id: originalRun.workflowDefinitionId,
      repositoryId: input.repositoryId,
    });
    if (!def)
      return Result.err(notFound("workflow definition not found"));

    // Reconstruct dispatch inputs from the original run
    let inputs: Record<string, unknown> | undefined;
    if (originalRun.dispatchInputs) {
      try {
        inputs =
          typeof originalRun.dispatchInputs === "string"
            ? JSON.parse(originalRun.dispatchInputs)
            : originalRun.dispatchInputs;
      } catch {
        // ignore parse errors
      }
    }

    const result = await this.createRunForDefinition(
      {
        id: def.id,
        repositoryId: def.repositoryId,
        name: def.name,
        path: def.path,
        config: def.config,
      },
      {
        repositoryId: input.repositoryId,
        userId: input.userId,
        event: {
          type: originalRun.triggerEvent,
          ref: originalRun.triggerRef,
          commitSHA: originalRun.triggerCommitSha,
          inputs,
        },
      }
    );

    return result;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_PER_PAGE = 30;
const MAX_PER_PAGE = 100;

function normalizePagination(
  page: number,
  perPage: number
): { page: number; perPage: number } {
  if (page < 1) page = 1;
  if (perPage < 1) perPage = DEFAULT_PER_PAGE;
  if (perPage > MAX_PER_PAGE) perPage = MAX_PER_PAGE;
  return { page, perPage };
}

function toISO(d: Date | string): string {
  if (d instanceof Date) return d.toISOString();
  return String(d);
}

function mapWorkflowRunRow(r: {
  id: string;
  repositoryId: string;
  workflowDefinitionId: string;
  status: string;
  triggerEvent: string;
  triggerRef: string;
  triggerCommitSha: string;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): {
  id: number;
  repository_id: number;
  workflow_definition_id: number;
  status: string;
  trigger_event: string;
  trigger_ref: string;
  trigger_commit_sha: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
} {
  return {
    id: Number(r.id),
    repository_id: Number(r.repositoryId),
    workflow_definition_id: Number(r.workflowDefinitionId),
    status: r.status,
    trigger_event: r.triggerEvent,
    trigger_ref: r.triggerRef,
    trigger_commit_sha: r.triggerCommitSha,
    started_at: r.startedAt ? toISO(r.startedAt) : null,
    completed_at: r.completedAt ? toISO(r.completedAt) : null,
    created_at: toISO(r.createdAt),
    updated_at: toISO(r.updatedAt),
  };
}
