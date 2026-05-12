import { apiClient } from '../api/client';
import { config } from '../app/config';
import type { GalleryAlbum } from '../types/wedding.types';
import { useCachedApiResource } from './useCachedApiResource';

const MOCK_GUEST_ALBUM: GalleryAlbum = {
    id: 'guest',
    title: 'Od gości',
    slug: 'od-gosci',
    description: 'Zdjęcia dodane przez gości.',
    coverUrl: null,
    itemCount: 120,
};

interface UseGalleryAlbumResult {
    album: GalleryAlbum | null;
    loading: boolean;
    error: string | null;
    reload: () => void;
}

export function useGalleryAlbum(slug: string | undefined): UseGalleryAlbumResult {
    const safeSlug = slug?.trim() ?? '';
    const { data, loading, error, reload } = useCachedApiResource<GalleryAlbum | null>({
        cacheKey: `gallery_album_${safeSlug}`,
        fetcher: () => {
            if (!safeSlug) {
                return Promise.resolve(null);
            }

            if (config.useMockPhotos) {
                return Promise.resolve(safeSlug === MOCK_GUEST_ALBUM.slug ? MOCK_GUEST_ALBUM : null);
            }

            return apiClient.getGalleryAlbum(safeSlug);
        },
        fallbackErrorMessage: 'Nie udało się pobrać albumu.',
        logContext: 'Failed to load gallery album',
        initialData: null,
    });

    return {
        album: data,
        loading,
        error,
        reload,
    };
}
