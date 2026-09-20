import type { UploadMediaKind } from './upload.types';

export type MediaUploadQueueScope = 'admin' | 'guest';
export type MediaUploadQueueItemStatus = 'queued' | 'preparing' | 'uploading' | 'error';

export interface MediaUploadQueueItem {
    id: string;
    scope: MediaUploadQueueScope;
    albumId: string | null;
    file: File;
    fileName: string;
    kind: UploadMediaKind;
    sizeBytes: number;
    status: MediaUploadQueueItemStatus;
    progress: number;
    errorMessage: string | null;
    createdAt: number;
}

export interface MediaUploadQueueSummary {
    totalCount: number;
    completedCount: number;
    activeCount: number;
    queuedCount: number;
    failedCount: number;
}

export interface MediaUploadEnqueueResult {
    addedCount: number;
    rejectedCount: number;
    errors: string[];
}
