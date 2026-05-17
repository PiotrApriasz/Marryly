import type { AdminSlideshowSettings } from '../../types/admin.types';
import { adminClient } from '../../api/adminClient';
import { useAdminApiResource } from './useAdminApiResource';

interface UseAdminSlideshowSettingsResult {
    settings: AdminSlideshowSettings;
    loading: boolean;
    error: string | null;
    reload: () => void;
}

const initialSettings: AdminSlideshowSettings = {
    albumIds: [],
    slideDurationSeconds: 8,
    refreshIntervalSeconds: 20,
    updatedAt: '',
};

export function useAdminSlideshowSettings(): UseAdminSlideshowSettingsResult {
    const { data, loading, error, reload } = useAdminApiResource<AdminSlideshowSettings>({
        cacheKey: 'slideshow_settings',
        fetcher: () => adminClient.getSlideshowSettings(),
        fallbackErrorMessage: 'Nie udało się pobrać ustawień pokazu slajdów.',
        logContext: 'Failed to load admin slideshow settings',
        initialData: initialSettings,
    });

    return {
        settings: data,
        loading,
        error,
        reload,
    };
}
