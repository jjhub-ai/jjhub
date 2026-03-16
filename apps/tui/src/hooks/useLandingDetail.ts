import { useState, useEffect, useCallback } from "react";
import { repoApiFetch } from "@jjhub/ui-core";
import type {
    LandingDetail,
    LandingComment,
    LandingReview,
    LandingChange,
    RepoContext,
} from "@jjhub/ui-core";

export type UseLandingDetailResult = {
    landing: LandingDetail | undefined;
    comments: LandingComment[];
    reviews: LandingReview[];
    changes: LandingChange[];
    loading: boolean;
    error: Error | undefined;
    refetch: () => void;
};

export function useLandingDetail(
    context: RepoContext,
    lrNumber: number,
): UseLandingDetailResult {
    const [landing, setLanding] = useState<LandingDetail | undefined>(undefined);
    const [comments, setComments] = useState<LandingComment[]>([]);
    const [reviews, setReviews] = useState<LandingReview[]>([]);
    const [changes, setChanges] = useState<LandingChange[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | undefined>(undefined);
    const [fetchKey, setFetchKey] = useState(0);

    const refetch = useCallback(() => {
        setFetchKey((k) => k + 1);
    }, []);

    useEffect(() => {
        if (!lrNumber) return;

        let cancelled = false;
        setLoading(true);
        setError(undefined);

        Promise.all([
            repoApiFetch(`/landings/${lrNumber}`, {}, context),
            repoApiFetch(`/landings/${lrNumber}/comments?per_page=100`, {}, context),
            repoApiFetch(`/landings/${lrNumber}/reviews?per_page=100`, {}, context),
            repoApiFetch(`/landings/${lrNumber}/changes?per_page=100`, {}, context),
        ])
            .then(async ([lrRes, commentsRes, reviewsRes, changesRes]) => {
                if (cancelled) return;
                if (!lrRes.ok) {
                    throw new Error(`Failed to load landing request (${lrRes.status})`);
                }
                const lrData = (await lrRes.json()) as LandingDetail;
                setLanding(lrData);

                if (commentsRes.ok) {
                    const data = await commentsRes.json();
                    setComments(Array.isArray(data) ? (data as LandingComment[]) : []);
                }
                if (reviewsRes.ok) {
                    const data = await reviewsRes.json();
                    setReviews(Array.isArray(data) ? (data as LandingReview[]) : []);
                }
                if (changesRes.ok) {
                    const data = await changesRes.json();
                    setChanges(Array.isArray(data) ? (data as LandingChange[]) : []);
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
    }, [context.owner, context.repo, lrNumber, fetchKey]);

    return { landing, comments, reviews, changes, loading, error, refetch };
}
