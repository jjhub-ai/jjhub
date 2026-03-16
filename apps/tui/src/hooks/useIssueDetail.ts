import { useState, useEffect, useCallback } from "react";
import { repoApiFetch } from "@jjhub/ui-core";
import type {
    IssueDetailResponse,
    IssueCommentResponse,
    RepoContext,
} from "@jjhub/ui-core";

export type UseIssueDetailResult = {
    issue: IssueDetailResponse | undefined;
    comments: IssueCommentResponse[];
    loading: boolean;
    error: Error | undefined;
    refetch: () => void;
};

export function useIssueDetail(
    context: RepoContext,
    issueNumber: number,
): UseIssueDetailResult {
    const [issue, setIssue] = useState<IssueDetailResponse | undefined>(undefined);
    const [comments, setComments] = useState<IssueCommentResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | undefined>(undefined);
    const [fetchKey, setFetchKey] = useState(0);

    const refetch = useCallback(() => {
        setFetchKey((k) => k + 1);
    }, []);

    useEffect(() => {
        if (!issueNumber) return;

        let cancelled = false;
        setLoading(true);
        setError(undefined);

        Promise.all([
            repoApiFetch(`/issues/${issueNumber}`, {}, context),
            repoApiFetch(`/issues/${issueNumber}/comments?per_page=100`, {}, context),
        ])
            .then(async ([issueRes, commentsRes]) => {
                if (cancelled) return;
                if (!issueRes.ok) {
                    throw new Error(`Failed to load issue (${issueRes.status})`);
                }
                const issueData = (await issueRes.json()) as IssueDetailResponse;
                setIssue(issueData);

                if (commentsRes.ok) {
                    const commentsData = await commentsRes.json();
                    setComments(
                        Array.isArray(commentsData)
                            ? (commentsData as IssueCommentResponse[])
                            : [],
                    );
                } else {
                    setComments([]);
                }
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err instanceof Error ? err : new Error(String(err)));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [context.owner, context.repo, issueNumber, fetchKey]);

    return { issue, comments, loading, error, refetch };
}
