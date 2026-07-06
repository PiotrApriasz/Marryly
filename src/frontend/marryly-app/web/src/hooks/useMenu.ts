import { apiClient } from '../api/client';
import { appText } from '../content/appText';
import { ApiError } from '../errors/apiError';
import type { Menu } from '../types/wedding.types';
import { invalidateCachedApiResource, useCachedApiResource } from './useCachedApiResource.ts';

interface UseMenuResult {
    menu: Menu | null;
    loading: boolean;
    error: string | null;
}

export const MENU_CACHE_KEY = 'wedding_menu_cache';

export function invalidateMenuCache(): void {
    invalidateCachedApiResource(MENU_CACHE_KEY);
}

export function useMenu(): UseMenuResult {
    const { data, loading, error } = useCachedApiResource<Menu | null>({
        cacheKey: MENU_CACHE_KEY,
        fetcher: async () => {
            try {
                return await apiClient.getMenu();
            } catch (error) {
                if (error instanceof ApiError && error.status === 404) {
                    return null;
                }

                throw error;
            }
        },
        fallbackErrorMessage: appText.errors.fallback.menu,
        logContext: 'Failed to load menu',
        initialData: null,
    });

    return { menu: data, loading, error };
}
