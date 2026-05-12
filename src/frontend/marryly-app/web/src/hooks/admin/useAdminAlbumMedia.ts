import type { AdminAlbumMediaPage } from '../../types/admin.types';
import { adminClient } from '../../api/adminClient';
import { useAdminApiResource } from './useAdminApiResource';

interface UseAdminAlbumMediaResult {
    mediaPage: AdminAlbumMediaPage;
    loading: boolean;
    error: string | null;
    reload: () => void;
}

export function useAdminAlbumMedia(albumId: string | undefined, page: number, pageSize: number): UseAdminAlbumMediaResult {
    const safeAlbumId = albumId?.trim() ?? '';
    const { data, loading, error, reload } = useAdminApiResource<AdminAlbumMediaPage>({
        cacheKey: `album_media_${safeAlbumId}_${page}_${pageSize}`,
        fetcher: () => safeAlbumId
            ? adminClient.getAlbumMedia(safeAlbumId, page, pageSize)
            : Promise.resolve({
                items: [],
                page,
                pageSize,
                totalCount: 0,
                totalPages: 1,
            }),
        fallbackErrorMessage: 'Nie udało się pobrać mediów albumu.',
        logContext: 'Failed to load admin album media',
        initialData: {
            items: [],
            page,
            pageSize,
            totalCount: 0,
            totalPages: 1,
        },
    });

    return {
        mediaPage: data,
        loading,
        error,
        reload,
    };
}
