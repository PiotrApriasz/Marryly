import { useCachedApiResource } from '../useCachedApiResource.ts';

const DEFAULT_ADMIN_CACHE_DURATION = 30 * 1000;

interface UseAdminApiResourceOptions<T> {
    cacheKey: string;
    fetcher: () => Promise<T>;
    fallbackErrorMessage: string;
    logContext: string;
    initialData: T;
    cacheDuration?: number;
}

interface UseAdminApiResourceResult<T> {
    data: T;
    loading: boolean;
    error: string | null;
}

export function useAdminApiResource<T>({
    cacheKey,
    fetcher,
    fallbackErrorMessage,
    logContext,
    initialData,
    cacheDuration = DEFAULT_ADMIN_CACHE_DURATION,
}: UseAdminApiResourceOptions<T>): UseAdminApiResourceResult<T> {
    return useCachedApiResource<T>({
        cacheKey: `admin_${cacheKey}`,
        fetcher,
        fallbackErrorMessage,
        logContext,
        initialData,
        cacheDuration,
    });
}
