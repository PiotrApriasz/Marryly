import type { AdminAlbumsResponse } from '../../types/admin.types';
import { adminClient } from '../../api/adminClient';
import { appText } from '../../content/appText';
import { useAdminApiResource } from './useAdminApiResource';

interface UseAdminAlbumsResult {
    albumsResponse: AdminAlbumsResponse;
    loading: boolean;
    error: string | null;
    reload: () => void;
}

export function useAdminAlbums(): UseAdminAlbumsResult {
    const { data, loading, error, reload } = useAdminApiResource<AdminAlbumsResponse>({
        cacheKey: 'albums',
        fetcher: () => adminClient.getAlbums(),
        fallbackErrorMessage: appText.errors.fallback.galleryAlbums,
        logContext: 'Failed to load admin albums',
        initialData: { items: [] },
    });

    return {
        albumsResponse: data,
        loading,
        error,
        reload,
    };
}
