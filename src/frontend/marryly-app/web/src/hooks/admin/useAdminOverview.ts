import { ApiError } from '../../errors/apiError';
import { adminClient } from '../../api/adminClient';
import type { AdminOverview } from '../../types/admin.types';
import { useAdminApiResource } from './useAdminApiResource';

const FALLBACK_OVERVIEW: AdminOverview = {
    photosCount: 0,
    guestsCount: 0,
    wishesCount: 0,
    menuPublished: false,
    attractionsCount: 0,
    settingsCount: 0,
};

interface UseAdminOverviewResult {
    overview: AdminOverview;
    loading: boolean;
    error: string | null;
}

export function useAdminOverview(): UseAdminOverviewResult {
    const { data, loading, error } = useAdminApiResource<AdminOverview>({
        cacheKey: 'overview',
        fetcher: async () => {
            try {
                return await adminClient.getOverview();
            } catch (err: unknown) {
                if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
                    return FALLBACK_OVERVIEW;
                }

                throw err;
            }
        },
        fallbackErrorMessage: 'Nie udało się pobrać danych panelu.',
        logContext: 'Failed to load admin overview',
        initialData: FALLBACK_OVERVIEW,
    });

    return {
        overview: data,
        loading,
        error,
    };
}
