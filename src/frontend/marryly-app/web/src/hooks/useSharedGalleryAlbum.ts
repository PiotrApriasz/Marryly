import { apiClient } from '../api/client';
import { appText } from '../content/appText';
import type { GalleryAlbum } from '../types/wedding.types';
import { useCachedApiResource } from './useCachedApiResource';

export function useSharedGalleryAlbum(shareCode: string | undefined, view: string) {
    const safeCode = shareCode?.trim() ?? '';
    return useCachedApiResource<GalleryAlbum | null>({
        cacheKey: `shared_gallery_album_${safeCode}_${view}`,
        fetcher: () => safeCode ? apiClient.getSharedGalleryAlbum(safeCode, view) : Promise.resolve(null),
        fallbackErrorMessage: appText.errors.fallback.galleryAlbum,
        logContext: 'Failed to load shared gallery album',
        initialData: null,
        cacheDuration: 0,
    });
}
