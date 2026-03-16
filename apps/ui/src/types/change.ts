export type RepoChange = {
    change_id: string;
    commit_id: string;
    description: string;
    author_name: string;
    author_email: string;
    timestamp: string;
    has_conflict: boolean;
    is_empty: boolean;
    parent_change_ids: string[];
};

export type ChangeResponse = RepoChange;
