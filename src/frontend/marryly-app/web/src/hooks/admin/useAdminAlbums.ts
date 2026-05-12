import type { AdminAlbumsResponse } from '../../types/admin.types';
import { adminClient } from '../../api/adminClient';
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
        fallbackErrorMessage: 'Nie udało się pobrać albumów.',
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
