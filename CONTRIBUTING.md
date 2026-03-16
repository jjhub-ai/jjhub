# Contributing to JJHub Community Edition

Thanks for your interest in contributing to JJHub. This guide covers everything you need to get productive quickly.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.1+
- [Docker](https://docs.docker.com/get-docker/) or [Podman](https://podman.io/) (for workspace containers)
- PostgreSQL 16+ (or use the bundled PGlite for development)
- [sqlc](https://sqlc.dev/) (only if you change database schema or queries)

### Setup

```bash
# Clone the repo
git clone https://github.com/jjhub-ai/jjhub.git
cd jjhub

# Install dependencies
bun install

# Start the dev server (hot reload)
bun run dev
```

The server starts on `http://localhost:3000`. Hit `GET /api/v1/health` to verify it works:

```bash
curl http://localhost:3000/api/v1/health
```

### Useful commands

```bash
bun run dev            # Start server with hot reload
bun run build:server   # Compile to single binary (dist/jjhub)
bun run build:cli      # Build the CLI
bun run check          # Run type checks across all packages
bun run test:e2e       # Run CLI end-to-end tests
bun run sqlc           # Regenerate TypeScript from SQL (requires sqlc)
bun run clean          # Remove build artifacts
```

## Project Structure

```
packages/
  sdk/            Core library — all business logic lives here
  workflow/       Workflow definition API (@jjhub-ai/workflow)
  ui-core/        Shared UI state and stores (nanostores + SolidJS)
  editor-core/    Shared logic for editor integrations (VS Code, Neovim)

apps/
  server/         HTTP + SSH server — thin Hono wrapper around @jjhub/sdk
  cli/            Command-line client (bun build --compile)
  ui/             Web UI (SolidJS + Vite + Tailwind v4)
  tui/            Terminal UI (Ink + React)
  desktop/        Desktop app (Electrobun)
  vscode-extension/  VS Code extension
  nvim-plugin/    Neovim plugin (Lua)

db/
  schema.sql      PostgreSQL schema (single file)
  queries/        sqlc-annotated SQL queries
  sqlc.yaml       sqlc configuration

e2e/
  cli/            CLI end-to-end tests (the API contract test suite)
```

### Key packages

**`@jjhub/sdk`** is the core. It contains all services (user, repo, issue, landing, workflow, etc.), database access, error types, and shared utilities. Every other package depends on it. If you are adding a feature, the business logic goes here.

**`@jjhub/server`** is intentionally thin. It is a Hono HTTP server that wires middleware, mounts route handlers, and delegates to SDK services. Route handlers should parse the request, call a service method, and return the result. No business logic in routes.

**`@jjhub-ai/workflow`** defines the TypeScript API that users write their CI/CD workflows against. It is published as a standalone package.

**`@jjhub/ui-core`** holds shared stores and state management consumed by both the web UI and TUI.

**`@jjhub/editor-core`** holds shared logic consumed by the VS Code extension and Neovim plugin.

## Architecture

### SDK-first design

All business logic lives in `packages/sdk/src/services/`. The server is a thin HTTP layer:

```
HTTP Request → Hono route handler → SDK service method → database (sqlc) → response
```

Route handlers in `apps/server/src/routes/` parse inputs, call services, and serialize results. They do not contain domain logic.

### Service registry

Services are initialized in `apps/server/src/services.ts`. Each service receives a database connection at startup:

```typescript
import { getServices } from "../services";

const { issue } = getServices();
const result = await issue.getByNumber(owner, repo, number);
```

### ContainerSandboxClient

JJHub Cloud uses Freestyle (Firecracker) VMs for workspace isolation. The Community Edition replaces this with `ContainerSandboxClient` in `packages/sdk/src/services/container-sandbox.ts`, which maps the same lifecycle operations onto Docker/Podman containers via `Bun.spawn()`.

The interface is intentionally compatible: same method names, same types, same flow. This means features built against the container sandbox automatically work with Freestyle VMs in JJHub Cloud.

Limitations of the container sandbox vs Cloud:
- No memory snapshots (suspend is `docker stop`, resume is `docker start`)
- No VM forking
- No microVM isolation (containers share the host kernel)

### Database layer

The database is PostgreSQL, accessed through [sqlc](https://sqlc.dev/)-generated TypeScript. The schema lives in `db/schema.sql` and queries in `db/queries/*.sql`. Generated code lands in `apps/server/src/db/` (do not edit these files manually).

For local development, the server can use PGlite (an in-process PostgreSQL) so you don't need a running database.

## Coding Conventions

### Error handling with `better-result`

Services return `Result<T, APIError>` from the `better-result` library instead of throwing exceptions. This is a deliberate choice to match the Go implementation's explicit error handling:

```typescript
import { Result } from "better-result";

async getUser(id: number): Promise<Result<UserProfile, APIError>> {
  const user = await getUserByID(this.db, { id });
  if (!user) {
    return Result.err(notFound("user not found"));
  }
  return Result.ok(mapUserProfile(user));
}
```

Rules:
- **Never throw exceptions in business logic.** Use `Result.err()` for expected errors.
- Thrown exceptions are reserved for genuinely unexpected failures (bugs, infrastructure issues).
- Route handlers unwrap the Result and call the appropriate error writer.

### Match the Go implementation

JJHub Cloud runs a Go API server. The TypeScript Community Edition must produce identical API responses. When implementing a feature:

- Use the same JSON field names (snake_case)
- Return the same HTTP status codes
- Use the same error format: `{ message: string, errors?: FieldError[] }`
- Pagination headers and query params must match

### Error format

All API errors follow this shape (Gitea-compatible):

```json
{
  "message": "not found",
  "errors": []
}
```

Use the error helpers from `packages/sdk/src/lib/errors.ts`: `notFound()`, `badRequest()`, `unauthorized()`, `forbidden()`, `conflict()`, `validationFailed()`, `internal()`.

### General style

- TypeScript strict mode everywhere
- Prefer `const` over `let`
- No default exports (except Hono route modules)
- No `any` — use `unknown` and narrow

## Testing

### CLI e2e tests are the contract

The tests in `e2e/cli/` are the source of truth for API behavior. They exercise the full stack: CLI talks to the server over HTTP, and the tests verify the responses. If an e2e test passes, the feature works.

```bash
# Run all e2e tests
bun run test:e2e

# Run a specific test file
cd e2e/cli && bun test issues.test.ts
```

### Writing a new e2e test

Tests use `bun:test` and the helpers in `e2e/cli/helpers.ts`:

```typescript
import { describe, test, expect } from "bun:test";
import { cli, jsonParse, uniqueName } from "./helpers";

describe("my-feature", () => {
  test("creates a thing", async () => {
    const name = uniqueName("thing");
    const result = await cli(["thing", "create", name], { json: true });
    const body = jsonParse(result);
    expect(body.name).toBe(name);
  });
});
```

The `cli()` helper spawns the CLI binary with the correct environment (API URL, auth token). Use `{ json: true }` for `--json` output and `jsonParse()` to extract the response.

### Type checking

```bash
bun run check    # Runs tsc --noEmit across all packages
```

## Database Changes

1. Edit `db/schema.sql` with your schema changes
2. Add or modify queries in `db/queries/*.sql` using [sqlc annotations](https://docs.sqlc.dev/en/latest/reference/query-annotations.html)
3. Regenerate TypeScript:
   ```bash
   bun run sqlc
   ```
4. The generated code appears in `apps/server/src/db/` -- never edit these files by hand
5. Import the generated functions in your service code

Example query annotation:

```sql
-- name: GetIssueByNumber :one
SELECT * FROM issues
WHERE repo_id = @repo_id AND number = @number;
```

## Adding a New API Route

1. **Implement the service** in `packages/sdk/src/services/`. Follow the `Result<T, APIError>` pattern. Export it from `packages/sdk/src/index.ts`.

2. **Register the service** in `apps/server/src/services.ts` by adding it to the `Services` interface and `initServices()`.

3. **Create the route handler** in `apps/server/src/routes/`. Route files export a Hono instance:

   ```typescript
   import { Hono } from "hono";
   import { getServices } from "../services";
   import { requireAuth } from "../lib/middleware";
   import { writeJSON, writeRouteError } from "@jjhub/sdk";

   const app = new Hono();

   app.get("/api/v1/things/:id", requireAuth, async (c) => {
     const { thing } = getServices();
     const result = await thing.getById(parseInt(c.req.param("id")));
     if (!result.ok) return writeRouteError(c, result.error);
     return writeJSON(c, result.value);
   });

   export default app;
   ```

4. **Mount the route** in `apps/server/src/index.ts`:

   ```typescript
   import things from "./routes/things";
   app.route("/", things);
   ```

5. **Add an e2e test** in `e2e/cli/` to verify the behavior.

## Pull Requests

### What we look for

- **e2e tests pass.** This is the baseline. If the CLI tests break, the PR is not ready.
- **Type checks pass.** Run `bun run check` before pushing.
- **Go/TypeScript parity.** If the feature exists in the Go implementation, the TypeScript version must produce identical API responses.
- **No dead code.** Don't leave commented-out blocks, `.bak` files, or unused imports. If code is replaced, delete the original.
- **Services in the SDK.** Business logic belongs in `packages/sdk/`, not in route handlers or the CLI.
- **Result-based error handling.** No thrown exceptions in service code.
- **Small, focused changes.** One feature or fix per PR. If a PR touches many unrelated areas, split it up.

### PR process

1. Fork and create a branch
2. Make your changes
3. Run `bun run check` and `bun run test:e2e`
4. Open a PR with a clear description of what changed and why
5. CI must pass before merge

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you agree to uphold this code. Report unacceptable behavior to conduct@jjhub.tech.

## License

By contributing to JJHub, you agree that your contributions will be licensed under the [AGPL-3.0 License](LICENSE).
