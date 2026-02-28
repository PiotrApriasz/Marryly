import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { Menu } from '../types/wedding.types';

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

                // Sprawdź cache w sessionStorage
                const cachedString = sessionStorage.getItem(CACHE_KEY);
                if (cachedString) {
                    const cached: CachedData = JSON.parse(cachedString);
                    const now = Date.now();

                    // Jeśli cache jest świeży, użyj go
                    if (now - cached.timestamp < CACHE_DURATION) {
                        setMenu(cached.data);
                        setLoading(false);
                        return;
                    }
                }

                // Pobierz z API
                const menuData = await apiClient.getMenu();
                setMenu(menuData);

                // Zapisz do cache
                const cacheData: CachedData = {
                    data: menuData,
                    timestamp: Date.now(),
                };
                sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
            } catch (err) {
                console.error("getMenu failed:", err);

                let msg = "Nie udało się pobrać menu";

                if (err && typeof err === "object") {
                    // axios-like
                    const anyErr = err as any;
                    msg =
                        anyErr?.response?.data?.message ??
                        anyErr?.response?.data?.error ??
                        anyErr?.message ??
                        msg;
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
