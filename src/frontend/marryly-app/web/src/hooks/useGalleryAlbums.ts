import { apiClient } from '../api/client';
import { config } from '../app/config';
import { appText } from '../content/appText';
import type { GalleryAlbumsResponse } from '../types/wedding.types';
import { useCachedApiResource } from './useCachedApiResource';

const MOCK_GALLERY_ALBUMS: GalleryAlbumsResponse = {
    items: [
        {
            id: 'guest',
            title: appText.public.gallery.defaultGuestAlbumTitle,
            slug: 'od-gosci',
            description: appText.public.gallery.defaultGuestAlbumDescription,
            coverUrl: null,
            itemCount: 120,
        },
    ],
};

interface UseGalleryAlbumsResult {
    albumsResponse: GalleryAlbumsResponse;
    loading: boolean;
    error: string | null;
    reload: () => void;
}

export function useGalleryAlbums(): UseGalleryAlbumsResult {
    const { data, loading, error, reload } = useCachedApiResource<GalleryAlbumsResponse>({
        cacheKey: 'gallery_albums',
        fetcher: () => config.useMockPhotos
            ? Promise.resolve(MOCK_GALLERY_ALBUMS)
            : apiClient.getGalleryAlbums(),
        fallbackErrorMessage: appText.errors.fallback.galleryAlbums,
        logContext: 'Failed to load gallery albums',
        initialData: { items: [] },
    });

    return {
        albumsResponse: data,
        loading,
        error,
        reload,
    };
}
