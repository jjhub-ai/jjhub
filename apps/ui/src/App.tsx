import { Router, Route, useNavigate, useParams } from '@solidjs/router';
import { withSentryRouterRouting } from '@sentry/solid/solidrouter';
import AppLayout from './layouts/AppLayout';
import FlaggedRoute from './components/FlaggedRoute';

// View Imports
import AgentSessionsList from './components/views/AgentSessionsList';
import ApiTokensManager from './components/views/ApiTokensManager';
import AdminConsoleView from './components/views/AdminConsoleView';
import BookmarkDetail from './components/views/BookmarkDetail';
import CodeExplorer from './components/views/CodeExplorer';
import ConnectedAccountsView from './components/views/ConnectedAccountsView';
import ReposList from './components/views/ReposList';
import GlobalSearch from './components/views/GlobalSearch';
import InboxView from './components/views/InboxView';
import IntegrationsList from './components/views/IntegrationsList';
import {
    GithubMirrorGuideView,
    NotionSyncGuideView,
} from './components/views/integrations/BuiltInIntegrationGuideViews';
import LinearIntegrationSetup from './components/views/LinearIntegrationSetup';
import IssueCreateForm from './components/views/IssueCreateForm';
import IssueDetail from './components/views/IssueDetail';
import IssuesList from './components/views/IssuesList';
import LandingQueue from './components/views/LandingQueue';
import LandingRequest from './components/views/LandingRequest';
import LandingsList from './components/views/LandingsList';
import LoginView from './components/views/LoginView';
import MarketingLandingPage from './components/views/MarketingLandingPage';
import NotificationPreferencesView from './components/views/NotificationPreferencesView';
import OrgCreateForm from './components/views/OrgCreateForm';
import OrgSettings from './components/views/OrgSettings';
import OAuthApplicationsView from './components/views/OAuthApplicationsView';
import TeamManagement, { TeamsList } from './components/views/TeamManagement';
import ReadoutDashboard from './components/views/ReadoutDashboard';
import RepoBookmarks from './components/views/RepoBookmarks';
import RepoChanges from './components/views/RepoChanges';
import RepoConflicts from './components/views/RepoConflicts';
import RepoCreateForm from './components/views/RepoCreateForm';
import RepoDeployKeysView from './components/views/RepoDeployKeysView';
import RepoGraph from './components/views/RepoGraph';
import ReleaseDetail from './components/views/ReleaseDetail';
import ReleasesList from './components/views/ReleasesList';
import RepoOverview from './components/views/RepoOverview';
import RepoSettings from './components/views/RepoSettings';

import RepoSnapshots from './components/views/RepoSnapshots';
import RepoTerminal from './components/views/RepoTerminal';
import RepoWikiView from './components/views/RepoWikiView';
import SSHKeysManager from './components/views/SSHKeysManager';
import SecretsManager from './components/views/SecretsManager';
import SessionReplay from './components/views/SessionReplay';
import SettingsView from './components/views/SettingsView';
import ClosedAlphaAccessView from './components/views/ClosedAlphaAccessView';
import ToolPolicies from './components/views/ToolPolicies';
import ToolSkills from './components/views/ToolSkills';
import NotFoundView from './components/views/NotFoundView';
import UserEmailsManager from './components/views/UserEmailsManager';
import UserProfile from './components/views/UserProfile';
import VariablesManager from './components/views/VariablesManager';
import WaitlistPage from './components/views/WaitlistPage';
import WorkflowRunDetail from './components/views/WorkflowRunDetail';
import WorkflowsList from './components/views/WorkflowsList';
import WorkspacesList from './components/views/WorkspacesList';
import ThankYouPage from './components/views/ThankYouPage';

const SentryRouter = withSentryRouterRouting(Router);

/** Redirect legacy /repo/:repo/* routes to /:owner/:repo/* using a fallback owner from env. */
function LegacyRepoRedirect() {
    const fallbackOwner = import.meta.env.PUBLIC_REPO_OWNER ?? "~";
    const navigate = useNavigate();
    const params = useParams<{ repo: string }>();
    const pathname = typeof window !== "undefined" ? window.location.pathname : "";
    const segments = pathname.split("/").filter(Boolean);
    // segments[0] === "repo", segments[1] === repoName, rest is sub-path
    const repoName = params.repo || segments[1] || "";
    const rest = segments.slice(2).join("/");
    const target = `/${fallbackOwner}/${repoName}${rest ? `/${rest}` : ""}`;
    navigate(target, { replace: true });
    return null;
}

export default function App() {
    return (
        <SentryRouter root={AppLayout}>
            <Route path="/" component={ReposList} />
            <Route path="/admin" component={AdminConsoleView} />
            <Route path="/admin/users" component={AdminConsoleView} />
            <Route path="/admin/orgs" component={AdminConsoleView} />
            <Route path="/admin/repos" component={AdminConsoleView} />
            <Route path="/admin/runners" component={AdminConsoleView} />
            <Route path="/admin/workflows" component={AdminConsoleView} />
            <Route path="/admin/health" component={AdminConsoleView} />
            <Route path="/admin/alpha" component={ClosedAlphaAccessView} />
            <Route path="/inbox" component={InboxView} />
            <Route path="/integrations" component={() => (
                <FlaggedRoute flag="integrations"><IntegrationsList /></FlaggedRoute>
            )} />
            <Route path="/integrations/github" component={() => (
                <FlaggedRoute flag="integrations"><GithubMirrorGuideView /></FlaggedRoute>
            )} />
            <Route path="/integrations/notion" component={() => (
                <FlaggedRoute flag="integrations"><NotionSyncGuideView /></FlaggedRoute>
            )} />
            <Route path="/integrations/linear" component={() => (
                <FlaggedRoute flag="integrations"><LinearIntegrationSetup /></FlaggedRoute>
            )} />
            <Route path="/login" component={LoginView} />
            <Route path="/marketing" component={MarketingLandingPage} />
            <Route path="/waitlist" component={WaitlistPage} />
            <Route path="/orgs/new" component={OrgCreateForm} />
            <Route path="/orgs/:org/settings" component={OrgSettings} />
            <Route path="/orgs/:org/teams" component={TeamsList} />
            <Route path="/orgs/:org/teams/:team" component={TeamManagement} />
            <Route path="/queue" component={() => (
                <FlaggedRoute flag="landing_queue"><LandingQueue /></FlaggedRoute>
            )} />
            <Route path="/readout" component={() => (
                <FlaggedRoute flag="readout_dashboard"><ReadoutDashboard /></FlaggedRoute>
            )} />
            {/* Legacy /repo/:repo/* redirects */}
            <Route path="/repo/new" component={RepoCreateForm} />
            <Route path="/repo/:repo/*" component={LegacyRepoRedirect} />
            {/* Owner-aware repository routes */}
            <Route path="/:owner/:repo" component={RepoOverview} />
            <Route path="/:owner/:repo/bookmarks" component={RepoBookmarks} />
            <Route path="/:owner/:repo/bookmarks/:name" component={BookmarkDetail} />
            <Route path="/:owner/:repo/changes" component={RepoChanges} />
            <Route path="/:owner/:repo/code" component={CodeExplorer} />
            <Route path="/:owner/:repo/conflicts" component={RepoConflicts} />
            <Route path="/:owner/:repo/graph" component={RepoGraph} />
            <Route path="/:owner/:repo/issues" component={IssuesList} />
            <Route path="/:owner/:repo/issues/:id" component={IssueDetail} />
            <Route path="/:owner/:repo/issues/new" component={IssueCreateForm} />
            <Route path="/:owner/:repo/landings" component={LandingsList} />
            <Route path="/:owner/:repo/landings/:id" component={LandingRequest} />
            <Route path="/:owner/:repo/keys" component={RepoDeployKeysView} />
            <Route path="/:owner/:repo/releases" component={ReleasesList} />
            <Route path="/:owner/:repo/releases/:id" component={ReleaseDetail} />
            <Route path="/:owner/:repo/settings" component={RepoSettings} />
            <Route path="/:owner/:repo/snapshots" component={() => (
                <FlaggedRoute flag="repo_snapshots"><RepoSnapshots /></FlaggedRoute>
            )} />
            <Route path="/:owner/:repo/terminal" component={RepoTerminal} />
            <Route path="/:owner/:repo/wiki" component={RepoWikiView} />
            <Route path="/:owner/:repo/wiki/new" component={RepoWikiView} />
            <Route path="/:owner/:repo/wiki/:slug/edit" component={RepoWikiView} />
            <Route path="/:owner/:repo/wiki/:slug" component={RepoWikiView} />
            <Route path="/:owner/:repo/workflows" component={WorkflowsList} />
            <Route path="/:owner/:repo/workflows/runs/:id" component={WorkflowRunDetail} />
            <Route path="/search" component={GlobalSearch} />
            <Route path="/:owner/:repo/sessions" component={() => (
                <FlaggedRoute flag="session_replay"><AgentSessionsList /></FlaggedRoute>
            )} />
            <Route path="/:owner/:repo/sessions/:sessionId" component={() => (
                <FlaggedRoute flag="session_replay"><SessionReplay /></FlaggedRoute>
            )} />
            <Route path="/settings" component={SettingsView} />
            <Route path="/settings/accounts" component={ConnectedAccountsView} />
            <Route path="/settings/alpha" component={ClosedAlphaAccessView} />
            <Route path="/settings/applications" component={OAuthApplicationsView} />
            <Route path="/settings/emails" component={UserEmailsManager} />
            <Route path="/settings/keys" component={SSHKeysManager} />
            <Route path="/settings/notifications" component={NotificationPreferencesView} />
            <Route path="/settings/secrets" component={SecretsManager} />
            <Route path="/settings/tokens" component={ApiTokensManager} />
            <Route path="/settings/variables" component={VariablesManager} />
            <Route path="/tools/policies" component={() => (
                <FlaggedRoute flag="tool_policies"><ToolPolicies /></FlaggedRoute>
            )} />
            <Route path="/tools/skills" component={() => (
                <FlaggedRoute flag="tool_skills"><ToolSkills /></FlaggedRoute>
            )} />
            <Route path="/:owner" component={UserProfile} />
            <Route path="/users/:username" component={UserProfile} />
            <Route path="/thank-you" component={ThankYouPage} />
            <Route path="/workspaces" component={WorkspacesList} />
            <Route path="*" component={NotFoundView} />
        </SentryRouter>
    );
}
