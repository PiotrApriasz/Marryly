import { useMemo, type ReactNode } from 'react';
import { MediaUploadQueueProvider, useMediaUploadQueue } from '../useMediaUploadQueue';
import type { AdminUploadEnqueueResult, AdminUploadQueueItem, AdminUploadQueueSummary } from '../../types/admin-upload.types';

interface AdminUploadQueueContextValue {
    items: AdminUploadQueueItem[];
    summary: AdminUploadQueueSummary;
    isHydrating: boolean;
    isOnline: boolean;
    pauseReason: 'offline' | 'session' | null;
    persistenceWarning: string | null;
    lastSummary: { successfulCount: number; failedCount: number } | null;
    completedAlbumIds: string[];
    completionVersion: number;
    enqueueFiles: (albumId: string, files: File[]) => Promise<AdminUploadEnqueueResult>;
    retryFailed: (albumId?: string) => Promise<void>;
    dismissLastSummary: () => void;
}

const EMPTY_SUMMARY: AdminUploadQueueSummary = {
    totalCount: 0,
    completedCount: 0,
    activeCount: 0,
    queuedCount: 0,
    failedCount: 0,
};

export function AdminUploadQueueProvider({ children }: { children: ReactNode }) {
    return <MediaUploadQueueProvider>{children}</MediaUploadQueueProvider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminUploadQueue(): AdminUploadQueueContextValue {
    const queue = useMediaUploadQueue();
    const isAdminQueue = queue.activeScope === 'admin';
    const items = useMemo<AdminUploadQueueItem[]>(
        () => isAdminQueue
            ? queue.items
                .filter((item) => item.scope === 'admin')
                .map((item) => ({
                    id: item.id,
                    albumId: item.albumId ?? '',
                    fileName: item.fileName,
                    sizeBytes: item.sizeBytes,
                    status: item.status,
                    progress: item.progress,
                    errorMessage: item.errorMessage,
                    createdAt: item.createdAt,
                }))
            : [],
        [isAdminQueue, queue.items],
    );
    const summary = isAdminQueue ? queue.summary : EMPTY_SUMMARY;
    const enqueueFiles = async (albumId: string, files: File[]): Promise<AdminUploadEnqueueResult> =>
        queue.enqueueFiles('admin', albumId, files, ['photo', 'video']);
    const retryFailed = (albumId?: string) => queue.retryFailed('admin', undefined, albumId);

    return {
        items,
        summary,
        isHydrating: queue.isHydrating,
        isOnline: queue.isOnline,
        pauseReason: isAdminQueue ? queue.pauseReason : null,
        persistenceWarning: isAdminQueue ? queue.persistenceWarning : null,
        lastSummary: isAdminQueue ? queue.lastSummary : null,
        completedAlbumIds: isAdminQueue ? queue.completedAlbumIds : [],
        completionVersion: queue.completionVersion,
        enqueueFiles,
        retryFailed,
        dismissLastSummary: queue.dismissLastSummary,
    };
}
