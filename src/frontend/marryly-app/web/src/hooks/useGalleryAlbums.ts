import { apiClient } from '../api/client';
import { config } from '../app/config';
import type { GalleryAlbumsResponse } from '../types/wedding.types';
import { useCachedApiResource } from './useCachedApiResource';

const MOCK_GALLERY_ALBUMS: GalleryAlbumsResponse = {
    items: [
        {
            id: 'guest',
            title: 'Od gości',
            slug: 'od-gosci',
            description: 'Zdjęcia dodane przez gości.',
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
        fallbackErrorMessage: 'Nie udało się pobrać albumów.',
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
