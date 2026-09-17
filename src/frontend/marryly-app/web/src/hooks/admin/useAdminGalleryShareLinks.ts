import { adminClient } from '../../api/adminClient';
import { useAdminApiResource } from './useAdminApiResource';
import type { AdminGalleryShareLinksResponse } from '../../types/admin.types';

export function useAdminGalleryShareLinks() {
    return useAdminApiResource<AdminGalleryShareLinksResponse>({
        cacheKey: 'gallery_share_links',
        fetcher: () => adminClient.getGalleryShareLinks(),
        fallbackErrorMessage: 'Nie udało się pobrać zapisanych linków.',
        logContext: 'Failed to load gallery share links',
        initialData: { items: [] },
    });
}
