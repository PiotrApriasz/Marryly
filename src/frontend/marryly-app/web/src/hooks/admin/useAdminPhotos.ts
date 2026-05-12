import type { AdminPhotosPage } from '../../types/admin.types';
import { adminClient } from '../../api/adminClient';
import { useAdminApiResource } from './useAdminApiResource';

interface UseAdminPhotosResult {
    photosPage: AdminPhotosPage;
    loading: boolean;
    error: string | null;
    reload: () => void;
}

export function useAdminPhotos(page: number, pageSize: number): UseAdminPhotosResult {
    const { data, loading, error, reload } = useAdminApiResource<AdminPhotosPage>({
        cacheKey: `photos_${page}_${pageSize}`,
        fetcher: () => adminClient.getPhotos(page, pageSize),
        fallbackErrorMessage: 'Nie udało się pobrać zdjęć.',
        logContext: 'Failed to load admin photos',
        initialData: {
            items: [],
            page,
            pageSize,
            totalCount: 0,
            totalPages: 1,
        },
    });

    return {
        photosPage: data,
        loading,
        error,
        reload,
    };
}
