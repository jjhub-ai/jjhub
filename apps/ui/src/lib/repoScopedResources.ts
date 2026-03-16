import { apiFetch, getCurrentRepoContext } from "./repoContext";

type CurrentUser = {
    username: string;
};

type RepoSummary = {
    id: number;
    name: string;
    description?: string;
    is_public: boolean;
};

type OrgSummary = {
    id: number;
    name: string;
};

export type RepoOption = {
    id: number;
    owner: string;
    repo: string;
    fullName: string;
    description: string;
    isPrivate: boolean;
};

export function parseRepoSelection(value: string): { owner: string; repo: string } | null {
    const [owner, repo] = value.split("/");
    if (!owner || !repo) {
        return null;
    }
    return { owner, repo };
}

const REPO_LIST_QUERY = "page=1&per_page=100";

async function loadRepoSummaries(path: string, errorMessage: string): Promise<RepoSummary[]> {
    const response = await apiFetch(`${path}?${REPO_LIST_QUERY}`);
    if (!response.ok) {
        throw new Error(`${errorMessage} (${response.status})`);
    }
    const body = (await response.json()) as RepoSummary[];
    return Array.isArray(body) ? body : [];
}

export async function loadUserRepoOptions(): Promise<RepoOption[]> {
    const [userRes, userRepos, orgsRes] = await Promise.all([
        apiFetch("/api/user"),
        loadRepoSummaries("/api/user/repos", "Failed to load repositories"),
        apiFetch(`/api/user/orgs?${REPO_LIST_QUERY}`),
    ]);

    if (!userRes.ok) {
        throw new Error(`Failed to load current user (${userRes.status})`);
    }
    if (!orgsRes.ok) {
        throw new Error(`Failed to load organizations (${orgsRes.status})`);
    }

    const user = (await userRes.json()) as CurrentUser;
    const orgs = (await orgsRes.json()) as OrgSummary[];
    const context = getCurrentRepoContext();

    const orgRepoGroups = await Promise.all(
        (Array.isArray(orgs) ? orgs : []).map(async (org) => ({
            owner: org.name,
            repos: await loadRepoSummaries(
                `/api/orgs/${encodeURIComponent(org.name)}/repos`,
                `Failed to load repositories for ${org.name}`,
            ),
        })),
    );

    const items = [
        ...userRepos.map((repo) => ({
            id: repo.id,
            owner: user.username,
            repo: repo.name,
            fullName: `${user.username}/${repo.name}`,
            description: repo.description ?? "",
            isPrivate: !repo.is_public,
        })),
        ...orgRepoGroups.flatMap(({ owner, repos }) => repos.map((repo) => ({
            id: repo.id,
            owner,
            repo: repo.name,
            fullName: `${owner}/${repo.name}`,
            description: repo.description ?? "",
            isPrivate: !repo.is_public,
        }))),
    ];

    items.sort((left, right) => {
        const leftIsCurrent = left.owner === context.owner && left.repo === context.repo;
        const rightIsCurrent = right.owner === context.owner && right.repo === context.repo;
        if (leftIsCurrent && !rightIsCurrent) return -1;
        if (!leftIsCurrent && rightIsCurrent) return 1;
        return left.fullName.localeCompare(right.fullName);
    });

    return items;
}
