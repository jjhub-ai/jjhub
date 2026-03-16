# UI

The UI lives inside the repo-wide Bun workspace. Install JavaScript dependencies from the repository root:

```sh
bun install --frozen-lockfile
```

Playwright lives in the standalone `e2e/` workspace. Install that boundary separately before running direct E2E commands:

```sh
cd e2e
bun install --frozen-lockfile
```

Common commands from the repository root:

| Command | Action |
| :------ | :----- |
| `cd apps/ui && bun run dev` | Start the local Vite dev server |
| `cd apps/ui && bun run build` | Build the UI bundle |
| `cd apps/ui && bun run preview` | Preview the production build locally |
| `cd apps/ui && bun run test` | Run the Vitest suite |
| `cd apps/ui && bun run test:e2e` | Run Playwright against the real backend stack |
| `cd apps/ui && bun run test:e2e:compose` | Boot the compose-backed E2E environment and run Playwright |

## E2E (Real Backend)

Run Playwright against the real API stack (no mocked routes):

```sh
cd apps/ui
bun run test:e2e:compose
```

This command uses `../../docker-compose.yml` + `../../docker-compose.ui-e2e.yml`.
