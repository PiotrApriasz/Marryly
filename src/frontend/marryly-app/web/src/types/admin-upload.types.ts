export type AdminUploadItemStatus = 'queued' | 'preparing' | 'uploading' | 'error';

export interface AdminUploadQueueItem {
    id: string;
    albumId: string;
    fileName: string;
    sizeBytes: number;
    status: AdminUploadItemStatus;
    progress: number;
    errorMessage: string | null;
    createdAt: number;
}

export interface AdminUploadQueueSummary {
    totalCount: number;
    completedCount: number;
    activeCount: number;
    queuedCount: number;
    failedCount: number;
}

export interface AdminUploadEnqueueResult {
    addedCount: number;
    rejectedCount: number;
    errors: string[];
}
