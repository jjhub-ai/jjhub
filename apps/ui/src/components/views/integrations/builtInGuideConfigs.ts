import type { BuiltInIntegrationGuideProps } from '../BuiltInIntegrationGuide';

export const githubMirrorGuide: BuiltInIntegrationGuideProps = {
    title: 'GitHub Mirror',
    description: 'Gitea-style repository mirroring for JJHub repositories. The service keeps a local bare cache, fetches JJHub refs, and pushes them to GitHub with `git push --mirror` on webhook events and a reconciliation interval.',
    icon: 'github',
    capabilities: ['Push mirror', 'Refs and tags', 'Webhook driven', 'Scheduled sync', 'Local bare cache'],
    statusNote: 'This integration is intentionally mirror-only. It does not translate GitHub pull requests into JJHub landing requests, and the destination GitHub repository must be created before you enable sync.',
    envVars: [
        { name: 'JJHUB_SYNC_MODE', description: 'Set to `mirror` to run the Gitea-style mirror worker. Defaults to `mirror`.' },
        { name: 'JJHUB_SYNC_JJHUB_API_URL', description: 'JJHub API URL. Kept for compatibility with metadata mode; mirror mode does not use it directly.', required: true },
        { name: 'JJHUB_SYNC_JJHUB_GIT_BASE_URL', description: 'Base Git URL for JJHub smart HTTP clones, for example `https://jjhub.tech`.', required: true },
        { name: 'JJHUB_SYNC_JJHUB_TOKEN', description: 'JJHub token used for authenticated fetches from JJHub.', required: true },
        { name: 'JJHUB_SYNC_JJHUB_WEBHOOK_SECRET', description: 'Shared secret for inbound JJHub webhooks.', required: true },
        { name: 'JJHUB_SYNC_GITHUB_API_URL', description: 'GitHub API base URL. Defaults to `https://api.github.com` and is used to verify that the destination repository exists before sync starts.' },
        { name: 'JJHUB_SYNC_CREDENTIAL_ENCRYPTION_KEY', description: 'Stable master key used to encrypt persisted sync credentials in SQLite.', required: true },
        { name: 'JJHUB_SYNC_GITHUB_TOKEN', description: 'GitHub PAT used to bootstrap or rotate the encrypted mirror credential. Required on first boot and PAT rotation.' },
        { name: 'JJHUB_SYNC_GITHUB_GIT_BASE_URL', description: 'Base Git URL for the destination host. Defaults to `https://github.com`.' },
        { name: 'JJHUB_SYNC_DB_PATH', description: 'Path to the SQLite mapping and encrypted-credential database. Defaults to `./data/github-sync.db`.' },
        { name: 'JJHUB_SYNC_MIRROR_CACHE_DIR', description: 'Directory used for local bare mirror clones. Defaults to `./data/github-mirrors`.' },
        { name: 'JJHUB_SYNC_INTERVAL_MS', description: 'Background reconciliation interval in milliseconds.' },
        { name: 'JJHUB_SYNC_MAPPINGS', description: 'JSON array mapping one JJHub repository to one GitHub mirror target.', required: true },
    ],
    configExample: `JJHUB_SYNC_MODE=mirror
JJHUB_SYNC_JJHUB_API_URL=https://api.jjhub.tech
JJHUB_SYNC_JJHUB_GIT_BASE_URL=https://jjhub.tech
JJHUB_SYNC_JJHUB_TOKEN=jjhub_xxx
JJHUB_SYNC_JJHUB_WEBHOOK_SECRET=jjhub-webhook-secret
JJHUB_SYNC_GITHUB_API_URL=https://api.github.com
JJHUB_SYNC_CREDENTIAL_ENCRYPTION_KEY=github-sync-master-key
JJHUB_SYNC_GITHUB_TOKEN=ghp_xxx
JJHUB_SYNC_MIRROR_CACHE_DIR=./data/github-mirrors
JJHUB_SYNC_INTERVAL_MS=300000
JJHUB_SYNC_MAPPINGS='[
  {
    "githubOwner": "acme",
    "githubRepo": "platform",
    "jjhubOwner": "acme",
    "jjhubRepo": "platform"
  }
]'
bun run apps/github-sync/src/main.ts --sync-existing`,
    mappingExample: `[
  {
    "githubOwner": "acme",
    "githubRepo": "platform",
    "jjhubOwner": "acme",
    "jjhubRepo": "platform"
  }
]`,
    webhookEvents: ['push', 'create', 'delete'],
    notes: [
        'Before you start the worker, create the destination repository on GitHub and make sure the configured token can see and push to it.',
        'On first boot, the worker encrypts `JJHUB_SYNC_GITHUB_TOKEN` into SQLite under the `github-mirror-write-token` credential purpose. Keep `JJHUB_SYNC_CREDENTIAL_ENCRYPTION_KEY` stable, and provide the PAT again only when rotating it.',
        'JJHub webhooks should target `/webhooks/jjhub` and subscribe to `push`, `create`, and `delete` so bookmark changes enqueue a mirror run immediately.',
        'GitHub webhooks are not required in mirror mode because GitHub is only the destination remote.',
        'Mirror startup verifies that the destination GitHub repository exists and fails with a provisioning error if it does not.',
        'This mirrors Git refs and tags. Wiki and docs sidecars are not mirrored by this service yet.',
    ],
};

export const notionSyncGuide: BuiltInIntegrationGuideProps = {
    title: 'Notion Sync',
    description: 'Poll Notion pages and databases, convert them to markdown, and commit them into the repository documents sidecar under a `notion/` tree.',
    icon: 'notion',
    capabilities: ['Markdown export', 'Docs sidecar', 'Polling', 'SQLite mappings'],
    envVars: [
        { name: 'JJHUB_SYNC_REPO_HOST_URL', description: 'Base URL for the repo-host service used to write docs-sidecar content.', required: true },
        { name: 'JJHUB_SYNC_REPO_HOST_TOKEN', description: 'Repo-host auth token.', required: true },
        { name: 'JJHUB_SYNC_NOTION_TOKEN', description: 'Notion integration token for the workspace or root page.', required: true },
        { name: 'JJHUB_SYNC_NOTION_ROOT_PAGE_ID', description: 'Root page or database ID to traverse from.', required: true },
        { name: 'JJHUB_SYNC_DB_PATH', description: 'Path to the SQLite page mapping database. Defaults to `./data/notion-sync.db`.' },
        { name: 'JJHUB_SYNC_POLL_INTERVAL_MS', description: 'Polling cadence for change detection.' },
        { name: 'JJHUB_SYNC_BOT_NAME', description: 'Commit author name for docs-sidecar commits.' },
        { name: 'JJHUB_SYNC_BOT_EMAIL', description: 'Commit author email for docs-sidecar commits.' },
        { name: 'JJHUB_SYNC_MAPPINGS', description: 'JSON array mapping Notion roots to JJHub repositories.', required: true },
    ],
    configExample: `JJHUB_SYNC_REPO_HOST_URL=http://localhost:4001
JJHUB_SYNC_REPO_HOST_TOKEN=repo-host-token
JJHUB_SYNC_NOTION_TOKEN=secret_xxx
JJHUB_SYNC_NOTION_ROOT_PAGE_ID=01234567-89ab-cdef-0123-456789abcdef
JJHUB_SYNC_POLL_INTERVAL_MS=60000
JJHUB_SYNC_MAPPINGS='[
  {
    "notionSpaceOrPageId": "01234567-89ab-cdef-0123-456789abcdef",
    "jjhubOwner": "acme",
    "jjhubRepo": "platform",
    "docsPrefix": "notion"
  }
]'
bun run apps/notion-sync/src/main.ts`,
    mappingExample: `[
  {
    "notionSpaceOrPageId": "01234567-89ab-cdef-0123-456789abcdef",
    "jjhubOwner": "acme",
    "jjhubRepo": "platform",
    "docsPrefix": "notion"
  }
]`,
    notes: [
        'The service writes markdown files into the documents sidecar and preserves Notion metadata in frontmatter.',
        'Container pages and databases use `index.md` so nested children can live in the same directory.',
        'Use `POST /sync/once` for an immediate run in addition to the background polling loop.',
    ],
};
