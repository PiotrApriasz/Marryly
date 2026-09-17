import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { config } from '../app/config';
import { appText } from '../content/appText';
import type { GalleryMediaItem } from '../types/wedding.types';
import { getErrorMessageForDisplay, logErrorDetails } from '../errors/apiError';
import { getMockPhotosPage } from '../mocks/photos';
import { sortMediaByDate } from '../utils/media';

interface UseInfiniteAlbumMediaOptions {
    albumSlug?: string;
    sharedView?: string;
    shareCode?: string;
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
    sharedView,
    shareCode,
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
        const albumIdentifier = shareCode ?? albumSlug;
        if (!albumIdentifier || requestInFlightRef.current) {
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
                : sharedView && shareCode
                    ? await apiClient.getSharedGalleryAlbumMedia(shareCode, sharedView, pageSize, nextToken)
                    : await apiClient.getGalleryAlbumMedia(albumSlug!, pageSize, nextToken);
            const nextItems = page.items
                .map((item) => ({ ...item, kind: item.kind ?? 'photo' }) as GalleryMediaItem)
                .filter((item) => !loadedIdsRef.current.has(item.id));

            nextItems.forEach((item) => loadedIdsRef.current.add(item.id));

            const orderedNextItems = sortMediaByDate(nextItems);
            setPhotos((currentPhotos) => append
                ? [...currentPhotos, ...orderedNextItems]
                : orderedNextItems);
            setContinuationToken(page.continuationToken);
            setHasMore(page.hasMore);
        } catch (err) {
            setError(getErrorMessageForDisplay(err, appText.errors.fallback.albumMedia));
            logErrorDetails(err, 'Failed to load album media');
        } finally {
            requestInFlightRef.current = false;
            setLoading(false);
            setLoadingMore(false);
        }
    }, [albumSlug, pageSize, shareCode, sharedView]);

    useEffect(() => {
        loadedIdsRef.current = new Set();
        setPhotos([]);
        setContinuationToken(null);
        setHasMore(true);

        if (!shareCode && !albumSlug) {
            setLoading(false);
            return;
        }

        void fetchPage(null, false);
    }, [albumSlug, fetchPage, shareCode]);

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
