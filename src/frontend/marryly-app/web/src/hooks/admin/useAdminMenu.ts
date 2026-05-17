import { adminClient } from '../../api/adminClient';
import type { AdminMenu } from '../../types/admin.types';
import { useAdminApiResource } from './useAdminApiResource';

const EMPTY_MENU: AdminMenu = {
    id: 'draft-menu',
    eventId: '',
    type: 'menu',
    title: 'Menu weselne',
    blocks: [],
};

interface UseAdminMenuResult {
    menu: AdminMenu;
    loading: boolean;
    error: string | null;
    reload: () => void;
}

export function useAdminMenu(): UseAdminMenuResult {
    const { data, loading, error, reload } = useAdminApiResource<AdminMenu>({
        cacheKey: 'menu',
        fetcher: () => adminClient.getMenu(),
        fallbackErrorMessage: 'Nie udało się pobrać menu.',
        logContext: 'Failed to load admin menu',
        initialData: EMPTY_MENU,
    });

    return {
        menu: data,
        loading,
        error,
        reload,
    };
}
