import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { config } from '../app/config';
import { appText } from '../content/appText';
import type { Photo } from '../types/wedding.types';
import { getErrorMessageForDisplay, logErrorDetails } from '../errors/apiError';
import { getMockPhotosPage } from '../mocks/photos';

interface UseInfinitePhotosOptions {
    pageSize?: number;
}

interface UseInfinitePhotosResult {
    photos: Photo[];
    loading: boolean;
    loadingMore: boolean;
    error: string | null;
    hasMore: boolean;
    loadMore: () => Promise<void>;
}

export function useInfinitePhotos({
    pageSize = 50,
}: UseInfinitePhotosOptions = {}): UseInfinitePhotosResult {
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [continuationToken, setContinuationToken] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const loadedIdsRef = useRef<Set<string>>(new Set());
    const requestInFlightRef = useRef(false);

    const fetchPage = useCallback(async (nextToken?: string | null, append = false) => {
        if (requestInFlightRef.current) {
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
            const page = config.useMockPhotos
                ? await getMockPhotosPage(pageSize, nextToken)
                : await apiClient.getPhotos(pageSize, nextToken);
            const nextItems = page.items.filter((item) => !loadedIdsRef.current.has(item.id));

            nextItems.forEach((item) => loadedIdsRef.current.add(item.id));

            setPhotos((currentPhotos) => append ? [...currentPhotos, ...nextItems] : nextItems);
            setContinuationToken(page.continuationToken);
            setHasMore(page.hasMore);
        } catch (err) {
            setError(getErrorMessageForDisplay(err, appText.errors.fallback.photos));
            logErrorDetails(err, 'Failed to load photos');
        } finally {
            requestInFlightRef.current = false;
            setLoading(false);
            setLoadingMore(false);
        }
    }, [pageSize]);

    useEffect(() => {
        loadedIdsRef.current = new Set();
        void fetchPage(null, false);
    }, [fetchPage]);

    const loadMore = useCallback(async () => {
        if (!hasMore || !continuationToken) {
            return;
        }

        await fetchPage(continuationToken, true);
    }, [continuationToken, fetchPage, hasMore]);

    return {
        photos,
        loading,
        loadingMore,
        error,
        hasMore,
        loadMore,
    };
}
