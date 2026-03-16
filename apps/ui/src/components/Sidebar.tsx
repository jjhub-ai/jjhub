import { createSignal, onMount, Show } from 'solid-js';
import { useStore } from '@nanostores/solid';
import { isSidebarCollapsed } from '../stores/workbench';
import { featureFlags } from '../lib/featureFlags';
import { $pinnedPages, $pinnedPagesReady } from '../stores/pinned-pages';
import {
  FolderOpen, GitMerge, FileDiff, Inbox, Bot,
  TerminalSquare, BookMarked, GitCommit, CheckCircle2,
  ChevronRight, ChevronDown, Activity, Settings, Wrench, Shield, GitGraph,
  BarChart2, Server, Cloud, Plus, Key, Lock, Asterisk, Play, KeyRound, BookOpen,
  Boxes,
  LogOut
} from 'lucide-solid';
import { getCurrentRepoContext, withAuthHeaders, apiFetch, logout } from '../lib/repoContext';
import { getShortcutText } from '../lib/keyboard';
import { isMacPlatform } from '../lib/keyboard/utils';
import PinnedSection from './PinnedSection';
import PrefetchLink from './PrefetchLink';
import {
  inboxNotificationsResource,
  issuesListResource,
  landingsListResource,
  repoBookmarksResource,
  repoChangesResource,
  repoContentsResource,
  userReposResource,
  workflowDefinitionsResource,
} from '../lib/navigationData';
import './Sidebar.css';

interface SidebarProps {
  activePath: string;
}

export default function Sidebar(props: SidebarProps) {
  const $isCollapsed = useStore(isSidebarCollapsed);
  const $flags = useStore(featureFlags);
  const $pinned = useStore($pinnedPages);
  const $pinnedReady = useStore($pinnedPagesReady);
  const [repoOpen, setRepoOpen] = createSignal(true);
  const [jjOpen, setJjOpen] = createSignal(true);
  const [workspaceOpen, setWorkspaceOpen] = createSignal(true);
  const [username, setUsername] = createSignal('');
  const [inboxCount, setInboxCount] = createSignal<number | null>(null);

  const ctx = () => getCurrentRepoContext(props.activePath);
  const hasRepo = () => Boolean(ctx().repo && ctx().owner);
  const repoName = () => ctx().repo || '';
  const repoBase = () =>
    hasRepo()
      ? `/${encodeURIComponent(ctx().owner)}/${encodeURIComponent(ctx().repo)}`
      : '';
  const shortcutPlatform = () => (isMacPlatform() ? 'mac' : 'default');
  const shortcutTitle = (label: string, shortcutId?: string) => {
    const shortcut = shortcutId ? getShortcutText(shortcutId, shortcutPlatform()) : "";
    return shortcut ? `${label} (${shortcut})` : label;
  };

  onMount(async () => {
    try {
      const res = await fetch('/api/user', { headers: withAuthHeaders() });
      if (res.ok) {
        const user = await res.json();
        setUsername(user.username || user.login || '');
      }
    } catch {}

    try {
      const notifRes = await apiFetch('/api/notifications/list?per_page=1');
      if (notifRes.ok) {
        const total = notifRes.headers.get('X-Total-Count');
        if (total) {
          setInboxCount(parseInt(total, 10) || null);
        }
      }
    } catch {}
  });

  return (
    <aside class={`sidebar forge-sidebar ${$isCollapsed() ? 'collapsed' : ''}`}>
      <div class="workspace-switcher" title={`${username() || 'user'} / Personal`}>
        <div class="avatar">{(username() || '?').charAt(0).toUpperCase()}</div>
        <div class="workspace-info">
          <span class="workspace-name">{username() || 'user'}</span>
          <span class="workspace-tier">Personal</span>
        </div>
        <ChevronDown size={14} class="text-muted ml-auto switch-icon" />
      </div>
      <div class="nav-groups mt-2">
        <Show when={$pinnedReady() && $pinned().length > 0}>
          <PinnedSection activeUrl={props.activePath} />
        </Show>

        <div class="nav-group mb-2">
          <PrefetchLink href="/" class="nav-item" title={shortcutTitle("Repositories", "nav.home")} prefetch={() => userReposResource.prefetch(1)}>
            <FolderOpen size={16} class="flex-shrink-0 text-muted" />
            <span class="nav-label">Repositories</span>
          </PrefetchLink>
          <Show when={$flags().readout_dashboard}>
            <a href="/readout" class="nav-item" title="Readout">
              <BarChart2 size={16} class="flex-shrink-0 text-muted" />
              <span class="nav-label">Readout</span>
            </a>
          </Show>
          <a href="/workspaces" class="nav-item" title="Workspaces">
            <Cloud size={16} class="flex-shrink-0 text-muted" />
            <span class="nav-label">Workspaces</span>
          </a>
          <Show when={$flags().integrations}>
            <a href="/integrations" class="nav-item" title="Integrations">
              <Server size={16} class="flex-shrink-0 text-muted" />
              <span class="nav-label">Integrations</span>
            </a>
          </Show>
        </div>


        <div class="nav-group mb-2">
          <PrefetchLink href="/inbox" class="nav-item" title={shortcutTitle("Inbox", "nav.inbox")} prefetch={() => inboxNotificationsResource.prefetch(1)}>
            <Inbox size={16} class="flex-shrink-0 text-muted" />
            <span class="nav-label">Inbox</span>
            <Show when={inboxCount() !== null && inboxCount()! > 0}>
              <div class="badge-count nav-label">{inboxCount()}</div>
            </Show>
          </PrefetchLink>
          <Show when={$flags().landing_queue}>
            <a href="/queue" class="nav-item" title="Landing Queue">
              <Activity size={16} class="flex-shrink-0 text-muted" />
              <span class="nav-label">Queue</span>
            </a>
          </Show>
        </div>

        <Show when={hasRepo()}>
          <div class="nav-group">
            <div class="repo-header" style={{ "margin-bottom": "4px" }}>
              <div class="repo-header-main" onClick={() => setRepoOpen(!repoOpen())} title={repoName()} aria-expanded={repoOpen()}>
                {repoOpen() ? <ChevronDown size={14} class="flex-shrink-0" /> : <ChevronRight size={14} class="flex-shrink-0" />}
                <span class="nav-label truncate">{repoName()}</span>
              </div>
              <div class="repo-header-actions">
                <a href={`${repoBase()}/settings`} class="repo-action-btn" title="Repository Settings">
                  <Settings size={14} />
                </a>
                <a href="/repo/new" class="repo-action-btn" title="New Repository">
                  <Plus size={14} />
                </a>
              </div>
            </div>

            <div class="repo-tree" classList={{ 'is-open': repoOpen() }}>
              <PrefetchLink href={`${repoBase()}/issues`} class="tree-item" title={shortcutTitle("Issues", "nav.issues")} prefetch={() => issuesListResource.prefetch(ctx())}>
                <CheckCircle2 size={16} class="flex-shrink-0 text-muted" />
                <span class="nav-label">Issues</span>
              </PrefetchLink>
              <PrefetchLink href={`${repoBase()}/landings`} class="tree-item" title={shortcutTitle("Landing Requests", "nav.landings")} prefetch={() => landingsListResource.prefetch(ctx())}>
                <GitMerge size={16} class="flex-shrink-0 text-muted" />
                <span class="nav-label">Landing Requests</span>
              </PrefetchLink>
              <PrefetchLink href={`${repoBase()}/workflows`} class="tree-item" title={shortcutTitle("Workflows", "nav.workflows")} prefetch={() => workflowDefinitionsResource.prefetch(ctx())}>
                <Play size={16} class="flex-shrink-0 text-muted" />
                <span class="nav-label">Workflows</span>
              </PrefetchLink>
              <a href={`${repoBase()}/releases`} class="tree-item" title="Releases">
                <Boxes size={16} class="flex-shrink-0 text-muted" />
                <span class="nav-label">Releases</span>
              </a>
              <a href={`${repoBase()}/wiki`} class="tree-item" title="Wiki">
                <BookOpen size={16} class="flex-shrink-0 text-muted" />
                <span class="nav-label">Wiki</span>
              </a>
              <a href={`${repoBase()}/keys`} class="tree-item" title="Deploy Keys">
                <Key size={16} class="flex-shrink-0 text-muted" />
                <span class="nav-label">Deploy Keys</span>
              </a>

              {/* Extended jj section */}
              <div class="tree-section mt-1" style={{ "margin-top": "16px" }}>
                <div class="tree-section-title" onClick={(e) => { e.preventDefault(); setJjOpen(!jjOpen()); }} title="Jujutsu (jj)" aria-expanded={jjOpen()}>
                  {jjOpen() ? <ChevronDown size={12} class="flex-shrink-0 text-muted" /> : <ChevronRight size={12} class="flex-shrink-0 text-muted" />}
                  <span class="nav-label text-xs text-muted font-semibold uppercase tracking-wider">Jujutsu</span>
                </div>
                <div class="tree-nested" classList={{ 'is-open': jjOpen() }}>
                  <PrefetchLink href={`${repoBase()}/changes`} class="tree-item" title={shortcutTitle("Changes", "nav.changes")} prefetch={() => repoChangesResource.prefetch(ctx())}>
                    <GitCommit size={16} class="flex-shrink-0 text-muted" />
                    <span class="nav-label">Changes</span>
                  </PrefetchLink>
                  <PrefetchLink href={`${repoBase()}/bookmarks`} class="tree-item" title={shortcutTitle("Bookmarks", "nav.bookmarks")} prefetch={() => repoBookmarksResource.prefetch(ctx())}>
                    <BookMarked size={16} class="flex-shrink-0 text-muted" />
                    <span class="nav-label">Bookmarks</span>
                  </PrefetchLink>
                  <a href={`${repoBase()}/conflicts`} class="tree-item" title="Conflicts">
                    <FileDiff size={16} class="flex-shrink-0 text-muted" />
                    <span class="nav-label">Conflicts</span>
                  </a>
                  <a href={`${repoBase()}/graph`} class="tree-item" title={shortcutTitle("Graph", "nav.graph")}>
                    <GitGraph size={16} class="flex-shrink-0 text-muted" />
                    <span class="nav-label">Graph</span>
                  </a>
                </div>
              </div>

              {/* Extended Workspace section */}
              <div class="tree-section mt-1" style={{ "margin-top": "16px" }}>
                <div class="tree-section-title" onClick={(e) => { e.preventDefault(); setWorkspaceOpen(!workspaceOpen()); }} title="Workspace" aria-expanded={workspaceOpen()}>
                  {workspaceOpen() ? <ChevronDown size={12} class="flex-shrink-0 text-muted" /> : <ChevronRight size={12} class="flex-shrink-0 text-muted" />}
                  <span class="nav-label text-xs text-muted font-semibold uppercase tracking-wider">Workspace</span>
                </div>
                <div class="tree-nested" classList={{ 'is-open': workspaceOpen() }}>
                  <PrefetchLink href={`${repoBase()}/code`} class="tree-item" title="Files" prefetch={() => repoContentsResource.prefetch(ctx(), "")}>
                    <FolderOpen size={16} class="flex-shrink-0 text-muted" />
                    <span class="nav-label">Files</span>
                  </PrefetchLink>
                  <a href={`${repoBase()}/terminal`} class="tree-item" title={shortcutTitle("Terminal", "nav.repoTerminal")}>
                    <TerminalSquare size={16} class="flex-shrink-0 text-muted" />
                    <span class="nav-label">Terminal</span>
                  </a>
                  <Show when={$flags().repo_snapshots}>
                    <a href={`${repoBase()}/snapshots`} class="tree-item" title="Snapshots">
                      <Bot size={16} class="flex-shrink-0 text-muted" />
                      <span class="nav-label">Snapshots</span>
                    </a>
                  </Show>
                  <Show when={$flags().session_replay}>
                    <a href={`${repoBase()}/sessions`} class="tree-item" title="Sessions">
                      <Bot size={16} class="flex-shrink-0 text-muted" />
                      <span class="nav-label">Sessions</span>
                    </a>
                  </Show>
                </div>
              </div>
            </div>
          </div>
        </Show>

        <div class="nav-group mt-auto">
          <div class="nav-group-title"><span class="nav-label">Tools</span></div>
          <Show when={$flags().tool_skills}>
            <a href="/tools/skills" class="tree-item subtle-item" title="Agent Skills">
              <Wrench size={14} class="flex-shrink-0" />
              <span class="nav-label">Agent Skills</span>
            </a>
          </Show>
          <Show when={$flags().tool_policies}>
            <a href="/tools/policies" class="tree-item subtle-item" title="Policies">
              <Shield size={14} class="flex-shrink-0 text-muted" />
              <span class="nav-label">Policies</span>
            </a>
          </Show>
          <a href="/admin" class="tree-item subtle-item" title="Admin">
            <Shield size={14} class="flex-shrink-0 text-muted" />
            <span class="nav-label">Admin</span>
          </a>
          <a href="/settings" class="tree-item subtle-item" title="Config">
            <Settings size={14} class="flex-shrink-0" />
            <span class="nav-label">Config</span>
          </a>
          <a href="/settings/keys" class="tree-item subtle-item" title="SSH Keys">
            <Key size={14} class="flex-shrink-0" />
            <span class="nav-label">SSH Keys</span>
          </a>
          <a href="/settings/tokens" class="tree-item subtle-item" title="API Tokens">
            <KeyRound size={14} class="flex-shrink-0" />
            <span class="nav-label">API Tokens</span>
          </a>
          <a href="/settings/secrets" class="tree-item subtle-item" title="Secrets">
            <Lock size={14} class="flex-shrink-0" />
            <span class="nav-label">Secrets</span>
          </a>
          <a href="/settings/variables" class="tree-item subtle-item" title="Variables">
            <Asterisk size={14} class="flex-shrink-0" />
            <span class="nav-label">Variables</span>
          </a>
          <a href="https://docs.jjhub.tech" target="_blank" rel="noopener noreferrer" class="tree-item subtle-item" title="Documentation">
            <BookOpen size={14} class="flex-shrink-0" />
            <span class="nav-label">Docs</span>
          </a>
          <button
            class="tree-item subtle-item sidebar-logout-btn"
            onClick={() => logout()}
            title="Sign out"
          >
            <LogOut size={14} class="flex-shrink-0 text-red" />
            <span class="nav-label">Sign out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
