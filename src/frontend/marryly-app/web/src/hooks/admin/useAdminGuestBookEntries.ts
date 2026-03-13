import type { AdminGuestBookEntry } from '../../types/admin.types';
import { adminClient } from '../../api/adminClient';
import { useAdminApiResource } from './useAdminApiResource';

interface UseAdminGuestBookEntriesResult {
    entries: AdminGuestBookEntry[];
    loading: boolean;
    error: string | null;
}

export function useAdminGuestBookEntries(): UseAdminGuestBookEntriesResult {
    const { data, loading, error } = useAdminApiResource<AdminGuestBookEntry[]>({
        cacheKey: 'guestbook_entries',
        fetcher: () => adminClient.getGuestBookEntries(),
        fallbackErrorMessage: 'Nie udało się pobrać życzeń.',
        logContext: 'Failed to load admin guestbook entries',
        initialData: [],
    });

    return {
        entries: data,
        loading,
        error,
    };
}
