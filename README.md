# JJHub

The jj-native software forge. Repos, issues, landing requests, CI, workspaces, agents — in one binary.

## Quick Start

```bash
# Download the binary
curl -fsSL https://jjhub.tech/install | sh

# Or run with Docker
docker run -p 3000:3000 -v jjhub-data:/data ghcr.io/jjhub-ai/jjhub:latest

# Or run from source
bun install
bun run dev
```

## What is JJHub?

JJHub is a complete code hosting platform built for [jj](https://martinvonz.github.io/jj/) — the Git-compatible VCS.

- **Forge** — repos, issues, landing requests, wiki, labels, milestones
- **jj-native** — bookmarks, changes, stacked changes, operation history
- **CI/CD** — TypeScript workflow definitions, DAG job graphs, artifacts
- **Workspaces** — cloud dev environments with suspend/resume
- **Agents** — AI-powered code agents in sandboxed environments

## Community Edition vs JJHub Cloud

This is **JJHub Community Edition** — the open-source, self-hosted version. It runs everything on one machine using containers for workspaces.

[JJHub Cloud](https://jjhub.tech) adds Firecracker VM isolation, sub-second snapshot resume, copy-on-write workspace forking, fleet management, and enterprise SSO.

Both editions share the same API. The same CLI works with both. Migrate by changing one URL.

## Development

```bash
# Install dependencies
bun install

# Run the server (hot reload)
bun run dev

# Build the single binary
bun run build:server

# Run CLI e2e tests
bun run test:e2e

# Regenerate sqlc types
bun run sqlc
```

## Project Structure

```
apps/
  server/     API server, SSH server, workspace service (Hono + Bun)
  cli/        Command-line client (shared with JJHub Cloud)
  ui/         Web UI (SolidJS, shared with JJHub Cloud)
packages/
  sdk/        Shared types and utilities
  workflow/   Workflow definition APIs (@jjhub/workflow)
db/
  schema.sql  Database schema (shared with JJHub Cloud)
  queries/    sqlc query definitions (generates TypeScript)
e2e/
  cli/        CLI e2e tests (the API contract test suite)
```

## License

AGPL-3.0 — see [LICENSE](LICENSE).
