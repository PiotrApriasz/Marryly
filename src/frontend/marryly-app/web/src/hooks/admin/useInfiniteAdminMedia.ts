import { useCallback, useEffect, useRef, useState } from 'react';
import { appText } from '../../content/appText';
import { getErrorMessageForDisplay, logErrorDetails } from '../../errors/apiError';

export interface AdminPagedMediaResponse<T> {
    items: T[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
}

interface UseInfiniteAdminMediaOptions<T> {
    resourceKey: string;
    pageSize: number;
    enabled?: boolean;
    fetchPage: (page: number, pageSize: number) => Promise<AdminPagedMediaResponse<T>>;
    getItemId: (item: T) => string;
    sortItems?: (items: T[]) => T[];
    fallbackErrorMessage?: string;
    logContext: string;
}

export interface UseInfiniteAdminMediaResult<T> {
    items: T[];
    loading: boolean;
    loadingMore: boolean;
    error: string | null;
    hasMore: boolean;
    totalCount: number;
    loadMore: () => Promise<void>;
    reload: () => void;
}

export function useInfiniteAdminMedia<T>({
    resourceKey,
    pageSize,
    enabled = true,
    fetchPage,
    getItemId,
    sortItems,
    fallbackErrorMessage = appText.errors.fallback.adminMedia,
    logContext,
}: UseInfiniteAdminMediaOptions<T>): UseInfiniteAdminMediaResult<T> {
    const [items, setItems] = useState<T[]>([]);
    const [nextPage, setNextPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(enabled);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);
    const loadedIdsRef = useRef<Set<string>>(new Set());
    const requestInFlightRef = useRef(false);
    const generationRef = useRef(0);

    const loadPage = useCallback(async (page: number, append: boolean, generation: number) => {
        if (!enabled || requestInFlightRef.current) {
            return;
        }

        requestInFlightRef.current = true;
        if (append) {
            setLoadingMore(true);
        } else {
            setLoading(true);
            setError(null);
        }

        try {
            const response = await fetchPage(page, pageSize);
            if (generation !== generationRef.current) {
                return;
            }

            const newItems = response.items
                .filter((item) => !loadedIdsRef.current.has(getItemId(item)));
            newItems.forEach((item) => loadedIdsRef.current.add(getItemId(item)));
            const orderedItems = sortItems ? sortItems(newItems) : newItems;

            setItems((currentItems) => append
                ? [...currentItems, ...orderedItems]
                : orderedItems);
            setNextPage(response.page + 1);
            setTotalCount(response.totalCount);
            setHasMore(response.page < response.totalPages);
        } catch (err: unknown) {
            if (generation !== generationRef.current) {
                return;
            }

            setError(getErrorMessageForDisplay(err, fallbackErrorMessage));
            logErrorDetails(err, logContext);
        } finally {
            if (generation === generationRef.current) {
                requestInFlightRef.current = false;
                setLoading(false);
                setLoadingMore(false);
            }
        }
    }, [enabled, fallbackErrorMessage, fetchPage, getItemId, logContext, pageSize, sortItems]);

    useEffect(() => {
        const generation = generationRef.current + 1;
        generationRef.current = generation;
        requestInFlightRef.current = false;
        loadedIdsRef.current = new Set();
        setItems([]);
        setNextPage(1);
        setTotalCount(0);
        setHasMore(true);
        setLoading(enabled);
        setLoadingMore(false);
        setError(null);

        if (enabled) {
            void loadPage(1, false, generation);
        }
    }, [enabled, loadPage, resourceKey, reloadToken]);

    const loadMore = useCallback(async () => {
        if (!hasMore || requestInFlightRef.current) {
            return;
        }

        await loadPage(nextPage, true, generationRef.current);
    }, [hasMore, loadPage, nextPage]);

    const reload = useCallback(() => {
        setReloadToken((current) => current + 1);
    }, []);

    return {
        items,
        loading,
        loadingMore,
        error,
        hasMore,
        totalCount,
        loadMore,
        reload,
    };
}
