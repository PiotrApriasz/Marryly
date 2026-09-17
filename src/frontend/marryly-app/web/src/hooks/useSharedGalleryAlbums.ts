import { apiClient } from '../api/client';
import { appText } from '../content/appText';
import type { GalleryAlbumsResponse } from '../types/wedding.types';
import { useCachedApiResource } from './useCachedApiResource';

export function useSharedGalleryAlbums(view: string) {
    return useCachedApiResource<GalleryAlbumsResponse>({
        cacheKey: `shared_gallery_albums_${view}`,
        fetcher: () => apiClient.getSharedGalleryAlbums(view),
        fallbackErrorMessage: appText.errors.fallback.galleryAlbums,
        logContext: 'Failed to load shared gallery albums',
        initialData: { items: [] },
    });
}
