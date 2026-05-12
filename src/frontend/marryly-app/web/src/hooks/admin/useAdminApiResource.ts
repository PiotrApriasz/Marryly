import {
    invalidateCachedApiResource,
    invalidateCachedApiResourcesByPrefix,
    useCachedApiResource,
} from '../useCachedApiResource.ts';

const DEFAULT_ADMIN_CACHE_DURATION = 30 * 1000;

export function getAdminCacheKey(cacheKey: string): string {
    return `admin_${cacheKey}`;
}

export function invalidateAdminCache(cacheKey: string): void {
    invalidateCachedApiResource(getAdminCacheKey(cacheKey));
}

export function invalidateAdminCacheByPrefix(prefix: string): void {
    invalidateCachedApiResourcesByPrefix(getAdminCacheKey(prefix));
}

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
    reload: () => void;
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
        cacheKey: getAdminCacheKey(cacheKey),
        fetcher,
        fallbackErrorMessage,
        logContext,
        initialData,
        cacheDuration,
    });
}
