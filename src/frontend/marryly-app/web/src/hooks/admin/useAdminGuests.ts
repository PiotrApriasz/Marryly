import { adminClient } from '../../api/adminClient';
import type { AdminGuestListResponse } from '../../types/admin.types';
import { useAdminApiResource } from './useAdminApiResource';

const EMPTY_GUEST_LIST: AdminGuestListResponse = {
    items: [],
    groups: [],
    summary: {
        invitedCount: 0,
        confirmedCount: 0,
        confirmationPercent: 0,
        attendingTotalWithCouple: 2,
        vendorsCount: 0,
        adultsCount: 0,
        children3To10Count: 0,
        childrenUnder3Count: 0,
        accommodationNeededCount: 0,
        transportNeededCount: 0,
    },
};

interface UseAdminGuestsResult {
    guestList: AdminGuestListResponse;
    loading: boolean;
    error: string | null;
    reload: () => void;
}

export function useAdminGuests(): UseAdminGuestsResult {
    const { data, loading, error, reload } = useAdminApiResource<AdminGuestListResponse>({
        cacheKey: 'guests',
        fetcher: () => adminClient.getGuests(),
        fallbackErrorMessage: 'Nie udało się pobrać listy gości.',
        logContext: 'Failed to load admin guests',
        initialData: EMPTY_GUEST_LIST,
    });

    return {
        guestList: data,
        loading,
        error,
        reload,
    };
}
