import { useCallback } from 'react';
import { adminClient } from '../../api/adminClient';
import { appText } from '../../content/appText';
import type { AdminAlbumMediaItem } from '../../types/admin.types';
import { sortMediaByDate } from '../../utils/media';
import { useInfiniteAdminMedia } from './useInfiniteAdminMedia';

function getAdminAlbumMediaId(mediaItem: AdminAlbumMediaItem): string {
    return mediaItem.id;
}

export function useAdminAlbumMedia(albumId: string | undefined, pageSize: number) {
    const safeAlbumId = albumId?.trim() ?? '';
    const fetchPage = useCallback(
        (page: number, size: number) => adminClient.getAlbumMedia(safeAlbumId, page, size),
        [safeAlbumId]
    );

    return useInfiniteAdminMedia<AdminAlbumMediaItem>({
        resourceKey: `album_media_${safeAlbumId}_${pageSize}`,
        pageSize,
        enabled: Boolean(safeAlbumId),
        fetchPage,
        getItemId: getAdminAlbumMediaId,
        sortItems: sortMediaByDate,
        fallbackErrorMessage: appText.errors.fallback.albumMedia,
        logContext: 'Failed to load admin album media',
    });
}
