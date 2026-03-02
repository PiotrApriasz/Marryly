import { useEffect, useRef, useState } from 'react';
import { getErrorMessageForDisplay, logErrorDetails } from '../errors/apiError.ts';

const DEFAULT_CACHE_DURATION = 5 * 60 * 1000;

interface CachedData<T> {
    data: T;
    timestamp: number;
}

interface UseCachedApiResourceOptions<T> {
    cacheKey: string;
    fetcher: () => Promise<T>;
    fallbackErrorMessage: string;
    logContext: string;
    initialData: T;
    cacheDuration?: number;
}

interface UseCachedApiResourceResult<T> {
    data: T;
    loading: boolean;
    error: string | null;
}

function readCachedData<T>(cacheKey: string, cacheDuration: number): T | null {
    const cachedString = sessionStorage.getItem(cacheKey);
    if (!cachedString) {
        return null;
    }

    try {
        const cached = JSON.parse(cachedString) as CachedData<T>;
        const isFresh = Date.now() - cached.timestamp < cacheDuration;

        if (isFresh) {
            return cached.data;
        }
    } catch {
        sessionStorage.removeItem(cacheKey);
        return null;
    }

    sessionStorage.removeItem(cacheKey);
    return null;
}

function writeCachedData<T>(cacheKey: string, data: T): void {
    const cachedData: CachedData<T> = {
        data,
        timestamp: Date.now(),
    };

    sessionStorage.setItem(cacheKey, JSON.stringify(cachedData));
}

export function useCachedApiResource<T>({
    cacheKey,
    fetcher,
    fallbackErrorMessage,
    logContext,
    initialData,
    cacheDuration = DEFAULT_CACHE_DURATION,
}: UseCachedApiResourceOptions<T>): UseCachedApiResourceResult<T> {
    const [data, setData] = useState<T>(initialData);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const fetcherRef = useRef(fetcher);
    const initialDataRef = useRef(initialData);
    const fallbackErrorMessageRef = useRef(fallbackErrorMessage);
    const logContextRef = useRef(logContext);

    fetcherRef.current = fetcher;
    initialDataRef.current = initialData;
    fallbackErrorMessageRef.current = fallbackErrorMessage;
    logContextRef.current = logContext;

    useEffect(() => {
        let isActive = true;

        const loadData = async () => {
            try {
                if (isActive) {
                    setLoading(true);
                    setError(null);
                }

                const cachedData = readCachedData<T>(cacheKey, cacheDuration);
                if (cachedData !== null) {
                    if (isActive) {
                        setData(cachedData);
                    }
                    return;
                }

                const freshData = await fetcherRef.current();
                if (!isActive) {
                    return;
                }

                setData(freshData);
                writeCachedData(cacheKey, freshData);
            } catch (err: unknown) {
                if (!isActive) {
                    return;
                }

                setError(getErrorMessageForDisplay(err, fallbackErrorMessageRef.current));
                logErrorDetails(err, logContextRef.current);
                setData(initialDataRef.current);
            } finally {
                if (isActive) {
                    setLoading(false);
                }
            }
        };

        void loadData();

        return () => {
            isActive = false;
        };
    }, [cacheDuration, cacheKey]);

    return { data, loading, error };
}
