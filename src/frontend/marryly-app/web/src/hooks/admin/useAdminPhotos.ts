import { useCallback } from 'react';
import { adminClient } from '../../api/adminClient';
import { appText } from '../../content/appText';
import type { AdminPhoto } from '../../types/admin.types';
import { sortMediaByDate } from '../../utils/media';
import { useInfiniteAdminMedia } from './useInfiniteAdminMedia';

function getAdminPhotoId(photo: AdminPhoto): string {
    return photo.id;
}

export function useAdminPhotos(pageSize: number) {
    const fetchPage = useCallback((page: number, size: number) => adminClient.getPhotos(page, size), []);

    return useInfiniteAdminMedia<AdminPhoto>({
        resourceKey: `photos_${pageSize}`,
        pageSize,
        fetchPage,
        getItemId: getAdminPhotoId,
        sortItems: sortMediaByDate,
        fallbackErrorMessage: appText.errors.fallback.adminMedia,
        logContext: 'Failed to load admin photos',
    });
}
