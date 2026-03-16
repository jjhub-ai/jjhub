import BuiltInIntegrationGuide from '../BuiltInIntegrationGuide';
import { githubMirrorGuide, notionSyncGuide } from './builtInGuideConfigs';

export function GithubMirrorGuideView() {
    return <BuiltInIntegrationGuide {...githubMirrorGuide} />;
}

export function NotionSyncGuideView() {
    return <BuiltInIntegrationGuide {...notionSyncGuide} />;
}
