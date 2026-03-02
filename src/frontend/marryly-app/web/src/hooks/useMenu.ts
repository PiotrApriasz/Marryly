import { apiClient } from '../api/client';
import type { Menu } from '../types/wedding.types';
import { useCachedApiResource } from './useCachedApiResource.ts';

interface UseMenuResult {
    menu: Menu | null;
    loading: boolean;
    error: string | null;
}

const CACHE_KEY = 'wedding_menu_cache';
export function useMenu(): UseMenuResult {
    const { data, loading, error } = useCachedApiResource<Menu | null>({
        cacheKey: CACHE_KEY,
        fetcher: () => apiClient.getMenu(),
        fallbackErrorMessage: 'Nie udało się pobrać menu.',
        logContext: 'Failed to load menu',
        initialData: null,
    });

    return { menu: data, loading, error };
}
