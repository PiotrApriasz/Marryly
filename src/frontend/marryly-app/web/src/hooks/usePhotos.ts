import { apiClient } from '../api/client';
import { useCachedApiResource } from './useCachedApiResource';
import type { Photo } from '../types/wedding.types';

interface UsePhotosOptions {
    cacheKey: string;
    cacheDuration: number;
}

export function usePhotos({ cacheKey, cacheDuration }: UsePhotosOptions) {
    return useCachedApiResource<Photo[]>({
        cacheKey,
        fetcher: () => apiClient.getPhotos(),
        fallbackErrorMessage: 'Nie udało się pobrać zdjęć.',
        logContext: 'Failed to load photos',
        initialData: [],
        cacheDuration,
    });
}
