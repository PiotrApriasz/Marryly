import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { Menu } from '../types/wedding.types';
import {ApiError} from "../errors/apiError.ts";

interface UseMenuResult {
    menu: Menu | null;
    loading: boolean;
    error: string | null;
}

const CACHE_KEY = 'wedding_menu_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minut

interface CachedData {
    data: Menu;
    timestamp: number;
}

export function useMenu(): UseMenuResult {
    const [menu, setMenu] = useState<Menu | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchMenu = async () => {
            try {
                setLoading(true);
                setError(null);

                const cachedString = sessionStorage.getItem(CACHE_KEY);
                if (cachedString) {
                    const cached = JSON.parse(cachedString) as CachedData;
                    const now = Date.now();

                    if (now - cached.timestamp < CACHE_DURATION) {
                        setMenu(cached.data);
                        setLoading(false);
                        return;
                    }
                }

                const menuData = await apiClient.getMenu();
                setMenu(menuData);

                const cacheData: CachedData = {
                    data: menuData,
                    timestamp: Date.now(),
                };
                sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
            } catch (err: unknown) {
                let msg = 'Nie udało się pobrać menu';

                if (err instanceof ApiError) {
                    // ładniejsze komunikaty
                    if (err.status === 404 || err.code === 'MENU_NOT_FOUND') {
                        msg = 'Menu weselne nie zostało jeszcze opublikowane';
                    } else {
                        msg = err.message || msg;
                    }

                    // debug meta
                    console.error('API error', {
                        status: err.status,
                        code: err.code,
                        traceId: err.traceId,
                        title: err.title,
                        detail: err.detail,
                    });

                    // WYŚWIETLANIE stackTrace (jeśli backend je zwraca)
                    const stack = err.raw?.stackTrace;
                    if (stack) {
                        console.error('API stackTrace:', stack);

                        // pokaż w UI (opcjonalnie tylko w dev)
                        msg += `\n\n--- STACK TRACE ---\n${stack}`;
                    }
                } else if (err instanceof Error) {
                    msg = err.message || msg;
                    console.error('Unexpected error:', err);
                } else {
                    console.error('Unknown error:', err);
                }

                setError(msg);
                setMenu(null);
            } finally {
                setLoading(false);
            }
        };

        fetchMenu();
    }, []);

    return { menu, loading, error };
}