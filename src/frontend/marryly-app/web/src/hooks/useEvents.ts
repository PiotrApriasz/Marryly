import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { Event } from '../types/wedding.types';

interface UseEventsResult {
    events: Event[];
    loading: boolean;
    error: string | null;
}

const CACHE_KEY = 'wedding_events_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minut

interface CachedData {
    data: Event[];
    timestamp: number;
}

export function useEvents(): UseEventsResult {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                setLoading(true);
                setError(null);

                // Sprawdź cache w sessionStorage
                const cachedString = sessionStorage.getItem(CACHE_KEY);
                if (cachedString) {
                    const cached: CachedData = JSON.parse(cachedString);
                    const now = Date.now();

                    // Jeśli cache jest świeży, użyj go
                    if (now - cached.timestamp < CACHE_DURATION) {
                        setEvents(cached.data);
                        setLoading(false);
                        return;
                    }
                }

                // Pobierz z API
                const eventsData = await apiClient.getEvents();
                setEvents(eventsData);

                // Zapisz do cache
                const cacheData: CachedData = {
                    data: eventsData,
                    timestamp: Date.now(),
                };
                sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Nie udało się pobrać wydarzeń';
                setError(errorMessage);
                setEvents([]);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, []);

    return { events, loading, error };
}
