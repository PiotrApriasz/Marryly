import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { config } from '../app/config';
import type { GalleryMediaItem } from '../types/wedding.types';
import { getErrorMessageForDisplay, logErrorDetails } from '../errors/apiError';
import { getMockPhotosPage } from '../mocks/photos';

interface UseInfiniteAlbumMediaOptions {
    albumSlug?: string;
    pageSize?: number;
}

interface UseInfiniteAlbumMediaResult {
    photos: GalleryMediaItem[];
    loading: boolean;
    loadingMore: boolean;
    error: string | null;
    hasMore: boolean;
    loadMore: () => Promise<void>;
}

export function useInfiniteAlbumMedia({
    albumSlug,
    pageSize = 50,
}: UseInfiniteAlbumMediaOptions = {}): UseInfiniteAlbumMediaResult {
    const [photos, setPhotos] = useState<GalleryMediaItem[]>([]);
    const [continuationToken, setContinuationToken] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const loadedIdsRef = useRef<Set<string>>(new Set());
    const requestInFlightRef = useRef(false);

    const fetchPage = useCallback(async (nextToken?: string | null, append = false) => {
        if (!albumSlug || requestInFlightRef.current) {
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
                : await apiClient.getGalleryAlbumMedia(albumSlug, pageSize, nextToken);
            const nextItems = page.items
                .map((item) => ({ ...item, kind: item.kind ?? 'photo' }) as GalleryMediaItem)
                .filter((item) => !loadedIdsRef.current.has(item.id));

            nextItems.forEach((item) => loadedIdsRef.current.add(item.id));

            setPhotos((currentPhotos) => append ? [...currentPhotos, ...nextItems] : nextItems);
            setContinuationToken(page.continuationToken);
            setHasMore(page.hasMore);
        } catch (err) {
            setError(getErrorMessageForDisplay(err, 'Nie udało się pobrać mediów albumu.'));
            logErrorDetails(err, 'Failed to load album media');
        } finally {
            requestInFlightRef.current = false;
            setLoading(false);
            setLoadingMore(false);
        }
    }, [albumSlug, pageSize]);

    useEffect(() => {
        loadedIdsRef.current = new Set();
        setPhotos([]);
        setContinuationToken(null);
        setHasMore(true);

        if (!albumSlug) {
            setLoading(false);
            return;
        }

        void fetchPage(null, false);
    }, [albumSlug, fetchPage]);

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
