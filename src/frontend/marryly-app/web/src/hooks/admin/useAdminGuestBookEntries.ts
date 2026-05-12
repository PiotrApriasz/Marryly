import type { AdminGuestBookEntriesPage } from '../../types/admin.types';
import { adminClient } from '../../api/adminClient';
import { useAdminApiResource } from './useAdminApiResource';

interface UseAdminGuestBookEntriesResult {
    entriesPage: AdminGuestBookEntriesPage;
    loading: boolean;
    error: string | null;
    reload: () => void;
}

export function useAdminGuestBookEntries(page: number, pageSize: number): UseAdminGuestBookEntriesResult {
    const { data, loading, error, reload } = useAdminApiResource<AdminGuestBookEntriesPage>({
        cacheKey: `guestbook_entries_${page}_${pageSize}`,
        fetcher: () => adminClient.getGuestBookEntries(page, pageSize),
        fallbackErrorMessage: 'Nie udało się pobrać życzeń.',
        logContext: 'Failed to load admin guestbook entries',
        initialData: {
            entries: [],
            page,
            pageSize,
            totalCount: 0,
            totalPages: 1,
        },
    });

    return {
        entriesPage: data,
        loading,
        error,
        reload,
    };
}
