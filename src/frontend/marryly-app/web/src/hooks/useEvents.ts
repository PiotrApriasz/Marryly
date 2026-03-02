import { apiClient } from '../api/client';
import type { Event } from '../types/wedding.types';
import { useCachedApiResource } from './useCachedApiResource.ts';

interface UseEventsResult {
    events: Event[];
    loading: boolean;
    error: string | null;
}

const CACHE_KEY = 'wedding_events_cache';
export function useEvents(): UseEventsResult {
    const { data, loading, error } = useCachedApiResource<Event[]>({
        cacheKey: CACHE_KEY,
        fetcher: () => apiClient.getEvents(),
        fallbackErrorMessage: 'Nie udało się pobrać harmonogramu dnia.',
        logContext: 'Failed to load events',
        initialData: [],
    });

    return { events: data, loading, error };
}
