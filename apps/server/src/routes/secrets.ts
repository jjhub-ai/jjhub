import { Hono } from "hono";
import {
  getUser,
  type FieldError,
  badRequest,
  unauthorized,
  validationFailed,
  writeError,
  writeJSON,
  writeRouteError,
} from "@jjhub/sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SetSecretRequest {
  name: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Validation — matches Go's validation.go
// ---------------------------------------------------------------------------

const SECRET_VARIABLE_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const MAX_SECRET_VARIABLE_NAME_LEN = 255;
const MAX_SECRET_VARIABLE_VALUE_SIZE = 64 * 1024; // 64 KiB

function validateSecretVariableName(name: string, resource: string): FieldError | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return { resource, field: "name", code: "missing_field" };
  }
  if (name.length > MAX_SECRET_VARIABLE_NAME_LEN) {
    return { resource, field: "name", code: "invalid" };
  }
  if (!SECRET_VARIABLE_NAME_PATTERN.test(name)) {
    return { resource, field: "name", code: "invalid" };
  }
  return null;
}

function validateSecretVariableValue(value: string, resource: string): FieldError | null {
  if (!value) {
    return { resource, field: "value", code: "missing_field" };
  }
  if (value.length > MAX_SECRET_VARIABLE_VALUE_SIZE) {
    return { resource, field: "value", code: "invalid" };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Service stub
// ---------------------------------------------------------------------------

const service = {
  listSecrets: async (
    _actor: any,
    _owner: string,
    _repo: string,
  ): Promise<any[]> => [],
  setSecret: async (
    _actor: any,
    _owner: string,
    _repo: string,
    _name: string,
    _value: string,
  ): Promise<any> => ({}),
  deleteSecret: async (
    _actor: any,
    _owner: string,
    _repo: string,
    _name: string,
  ): Promise<void> => {},
  // Variable stubs
  listVariables: async (
    _actor: any,
    _owner: string,
    _repo: string,
  ): Promise<any[]> => [],
  setVariable: async (
    _actor: any,
    _owner: string,
    _repo: string,
    _name: string,
    _value: string,
  ): Promise<any> => ({}),
  deleteVariable: async (
    _actor: any,
    _owner: string,
    _repo: string,
    _name: string,
  ): Promise<void> => {},
};

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const app = new Hono();

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

// GET /api/repos/:owner/:repo/secrets
app.get("/api/repos/:owner/:repo/secrets", async (c) => {
  const actor = getUser(c);
  const { owner, repo } = c.req.param();

  try {
    const secrets = await service.listSecrets(actor, owner, repo);
    return writeJSON(c, 200, secrets);
  } catch (err) {
    return writeRouteError(c, err);
  }
});

// POST /api/repos/:owner/:repo/secrets
app.post("/api/repos/:owner/:repo/secrets", async (c) => {
  const actor = getUser(c);
  if (!actor) {
    return writeError(c, unauthorized("authentication required"));
  }
  const { owner, repo } = c.req.param();

  let body: SetSecretRequest;
  try {
    body = await c.req.json<SetSecretRequest>();
  } catch {
    return writeError(c, badRequest("invalid request body"));
  }

  const nameErr = validateSecretVariableName(body.name, "Secret");
  if (nameErr) {
    return writeError(c, validationFailed(nameErr));
  }
  const valueErr = validateSecretVariableValue(body.value, "Secret");
  if (valueErr) {
    return writeError(c, validationFailed(valueErr));
  }

  try {
    const secret = await service.setSecret(
      actor,
      owner,
      repo,
      body.name,
      body.value,
    );
    return writeJSON(c, 201, secret);
  } catch (err) {
    return writeRouteError(c, err);
  }
});

// DELETE /api/repos/:owner/:repo/secrets/:name
app.delete("/api/repos/:owner/:repo/secrets/:name", async (c) => {
  const actor = getUser(c);
  if (!actor) {
    return writeError(c, unauthorized("authentication required"));
  }
  const { owner, repo, name } = c.req.param();

  if (!name.trim()) {
    return writeError(c, badRequest("secret name is required"));
  }

  const nameErr = validateSecretVariableName(name, "Secret");
  if (nameErr) {
    return writeError(c, validationFailed(nameErr));
  }

  try {
    await service.deleteSecret(actor, owner, repo, name);
    return c.body(null, 204);
  } catch (err) {
    return writeRouteError(c, err);
  }
});

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------

// GET /api/repos/:owner/:repo/variables
app.get("/api/repos/:owner/:repo/variables", async (c) => {
  const actor = getUser(c);
  const { owner, repo } = c.req.param();

  try {
    const variables = await service.listVariables(actor, owner, repo);
    return writeJSON(c, 200, variables);
  } catch (err) {
    return writeRouteError(c, err);
  }
});

// POST /api/repos/:owner/:repo/variables
app.post("/api/repos/:owner/:repo/variables", async (c) => {
  const actor = getUser(c);
  if (!actor) {
    return writeError(c, unauthorized("authentication required"));
  }
  const { owner, repo } = c.req.param();

  let body: SetSecretRequest;
  try {
    body = await c.req.json<SetSecretRequest>();
  } catch {
    return writeError(c, badRequest("invalid request body"));
  }

  const nameErr = validateSecretVariableName(body.name, "Variable");
  if (nameErr) {
    return writeError(c, validationFailed(nameErr));
  }
  const valueErr = validateSecretVariableValue(body.value, "Variable");
  if (valueErr) {
    return writeError(c, validationFailed(valueErr));
  }

  try {
    const variable = await service.setVariable(
      actor,
      owner,
      repo,
      body.name,
      body.value,
    );
    return writeJSON(c, 201, variable);
  } catch (err) {
    return writeRouteError(c, err);
  }
});

// DELETE /api/repos/:owner/:repo/variables/:name
app.delete("/api/repos/:owner/:repo/variables/:name", async (c) => {
  const actor = getUser(c);
  if (!actor) {
    return writeError(c, unauthorized("authentication required"));
  }
  const { owner, repo, name } = c.req.param();

  if (!name.trim()) {
    return writeError(c, badRequest("variable name is required"));
  }

  const nameErr = validateSecretVariableName(name, "Variable");
  if (nameErr) {
    return writeError(c, validationFailed(nameErr));
  }

  try {
    await service.deleteVariable(actor, owner, repo, name);
    return c.body(null, 204);
  } catch (err) {
    return writeRouteError(c, err);
  }
});

export default app;
